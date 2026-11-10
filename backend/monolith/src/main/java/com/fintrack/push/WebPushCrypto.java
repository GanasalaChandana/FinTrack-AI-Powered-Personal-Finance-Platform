package com.fintrack.push;

import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.ByteArrayOutputStream;
import java.math.BigInteger;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.*;
import java.util.Arrays;
import java.util.Base64;

/**
 * Web Push with only the JDK:
 * <ul>
 *   <li>message encryption, RFC 8291 ("aes128gcm" content coding, RFC 8188)</li>
 *   <li>VAPID, RFC 8292: an ES256 JWT that identifies this server to the push service</li>
 * </ul>
 * Keys are P-256; public keys travel as 65-byte uncompressed points, base64url.
 */
public final class WebPushCrypto {
    private WebPushCrypto() {}

    static final int RECORD_SIZE = 4096;
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final ECParameterSpec P256 = p256();

    // ── keys ────────────────────────────────────────────────────────────────

    public static KeyPair newKeyPair() {
        try {
            KeyPairGenerator g = KeyPairGenerator.getInstance("EC");
            g.initialize(new ECGenParameterSpec("secp256r1"), RANDOM);
            return g.generateKeyPair();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    /** 0x04 || X || Y */
    public static byte[] rawPublic(ECPublicKey k) {
        byte[] out = new byte[65];
        out[0] = 4;
        System.arraycopy(fixed32(k.getW().getAffineX()), 0, out, 1, 32);
        System.arraycopy(fixed32(k.getW().getAffineY()), 0, out, 33, 32);
        return out;
    }

    public static byte[] rawPrivate(ECPrivateKey k) {
        return fixed32(k.getS());
    }

    public static ECPublicKey publicKey(byte[] raw) {
        if (raw.length != 65 || raw[0] != 4) throw new IllegalArgumentException("Not an uncompressed P-256 point");
        try {
            ECPoint w = new ECPoint(new BigInteger(1, Arrays.copyOfRange(raw, 1, 33)),
                                    new BigInteger(1, Arrays.copyOfRange(raw, 33, 65)));
            return (ECPublicKey) KeyFactory.getInstance("EC").generatePublic(new ECPublicKeySpec(w, P256));
        } catch (GeneralSecurityException e) {
            throw new IllegalArgumentException("Invalid P-256 public key", e);
        }
    }

    public static ECPrivateKey privateKey(byte[] raw) {
        try {
            return (ECPrivateKey) KeyFactory.getInstance("EC")
                    .generatePrivate(new ECPrivateKeySpec(new BigInteger(1, raw), P256));
        } catch (GeneralSecurityException e) {
            throw new IllegalArgumentException("Invalid P-256 private key", e);
        }
    }

    // ── RFC 8291 encryption ─────────────────────────────────────────────────

    /** Encrypts for one subscription; the result is the whole request body. */
    public static byte[] encrypt(byte[] plaintext, byte[] uaPublicRaw, byte[] authSecret) {
        return encrypt(plaintext, uaPublicRaw, authSecret, newKeyPair(), randomBytes(16));
    }

    /** Deterministic form, for tests (ephemeral key pair and salt given). */
    static byte[] encrypt(byte[] plaintext, byte[] uaPublicRaw, byte[] authSecret, KeyPair ephemeral, byte[] salt) {
        if (plaintext.length > RECORD_SIZE - 17) throw new IllegalArgumentException("Push message too long");
        try {
            byte[] asPublicRaw = rawPublic((ECPublicKey) ephemeral.getPublic());
            KeyAgreement ka = KeyAgreement.getInstance("ECDH");
            ka.init(ephemeral.getPrivate());
            ka.doPhase(publicKey(uaPublicRaw), true);
            byte[] ecdhSecret = ka.generateSecret();

            // IKM = HKDF(auth_secret, ecdh_secret, "WebPush: info" 0x00 ua_public as_public, 32)
            byte[] prkKey = hmac(authSecret, ecdhSecret);
            byte[] keyInfo = concat("WebPush: info".getBytes(StandardCharsets.US_ASCII), new byte[]{0}, uaPublicRaw, asPublicRaw);
            byte[] ikm = hmac(prkKey, concat(keyInfo, new byte[]{1}));

            byte[] prk = hmac(salt, ikm);
            byte[] cek = Arrays.copyOf(hmac(prk, concat("Content-Encoding: aes128gcm".getBytes(StandardCharsets.US_ASCII), new byte[]{0, 1})), 16);
            byte[] nonce = Arrays.copyOf(hmac(prk, concat("Content-Encoding: nonce".getBytes(StandardCharsets.US_ASCII), new byte[]{0, 1})), 12);

            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(cek, "AES"), new GCMParameterSpec(128, nonce));
            byte[] ciphertext = c.doFinal(concat(plaintext, new byte[]{2})); // 0x02: last (only) record

            ByteBuffer header = ByteBuffer.allocate(16 + 4 + 1 + 65);
            header.put(salt).putInt(RECORD_SIZE).put((byte) 65).put(asPublicRaw);
            return concat(header.array(), ciphertext);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Push encryption failed", e);
        }
    }

    // ── RFC 8292 VAPID ──────────────────────────────────────────────────────

    /** "vapid t=<jwt>, k=<public key>" for the push service at {@code audience} (scheme://host). */
    public static String vapidAuthorization(String audience, String subject, KeyPair vapid, long expiresEpochSeconds) {
        String header = b64(json("{\"typ\":\"JWT\",\"alg\":\"ES256\"}"));
        String claims = b64(json("{\"aud\":\"" + audience + "\",\"exp\":" + expiresEpochSeconds + ",\"sub\":\"" + subject + "\"}"));
        String signingInput = header + "." + claims;
        try {
            Signature s = Signature.getInstance("SHA256withECDSAinP1363Format"); // raw r||s, as JOSE wants
            s.initSign(vapid.getPrivate());
            s.update(signingInput.getBytes(StandardCharsets.US_ASCII));
            String jwt = signingInput + "." + b64(s.sign());
            return "vapid t=" + jwt + ", k=" + b64(rawPublic((ECPublicKey) vapid.getPublic()));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("VAPID signing failed", e);
        }
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    public static String b64(byte[] b) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    public static byte[] unb64(String s) {
        return Base64.getUrlDecoder().decode(s.trim().replace('+', '-').replace('/', '_').replace("=", ""));
    }

    private static byte[] json(String s) {
        return s.getBytes(StandardCharsets.UTF_8);
    }

    private static byte[] hmac(byte[] key, byte[] data) throws GeneralSecurityException {
        Mac m = Mac.getInstance("HmacSHA256");
        m.init(new SecretKeySpec(key, "HmacSHA256"));
        return m.doFinal(data);
    }

    private static byte[] concat(byte[]... parts) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        for (byte[] p : parts) out.writeBytes(p);
        return out.toByteArray();
    }

    private static byte[] randomBytes(int n) {
        byte[] b = new byte[n];
        RANDOM.nextBytes(b);
        return b;
    }

    private static byte[] fixed32(BigInteger v) {
        byte[] b = v.toByteArray();
        if (b.length == 32) return b;
        byte[] out = new byte[32];
        if (b.length > 32) System.arraycopy(b, b.length - 32, out, 0, 32);  // drop sign byte
        else System.arraycopy(b, 0, out, 32 - b.length, b.length);          // left-pad
        return out;
    }

    private static ECParameterSpec p256() {
        try {
            AlgorithmParameters p = AlgorithmParameters.getInstance("EC");
            p.init(new ECGenParameterSpec("secp256r1"));
            return p.getParameterSpec(ECParameterSpec.class);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }
}
