package com.fintrack.common;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

/**
 * Sends plain-text email. Two ways, the first one configured wins:
 * <ul>
 *   <li>Brevo's HTTPS API (BREVO_API_KEY + MAIL_FROM): works on hosts that block
 *       outgoing SMTP, such as Render's free tier</li>
 *   <li>SMTP (MAIL_HOST, MAIL_USERNAME, MAIL_PASSWORD), e.g. Gmail with an app password</li>
 * </ul>
 * Without either, nothing is sent.
 */
@Service
@Slf4j
public class EmailService {

    private static final String BREVO_URL = "https://api.brevo.com/v3/smtp/email";

    private final JavaMailSender mailSender;
    private final String username;
    private final String from;
    private final String brevoKey;
    private final RestClient http;

    public EmailService(@Autowired(required = false) JavaMailSender mailSender,
                        @Value("${spring.mail.username:}") String username,
                        @Value("${app.mail.from:}") String from,
                        @Value("${app.mail.brevo-api-key:}") String brevoKey) {
        this.mailSender = mailSender;
        this.username = username;
        this.from = from;
        this.brevoKey = brevoKey;
        SimpleClientHttpRequestFactory f = new SimpleClientHttpRequestFactory();
        f.setConnectTimeout(5_000);
        f.setReadTimeout(10_000);
        this.http = RestClient.builder().requestFactory(f).build();
    }

    private boolean useBrevo() {
        return brevoKey != null && !brevoKey.isBlank();
    }

    public boolean isConfigured() {
        return useBrevo() || (mailSender != null && username != null && !username.isBlank());
    }

    private String sender() {
        return from == null || from.isBlank() ? username : from;
    }

    /** True when the message was accepted for delivery. */
    public boolean send(String to, String subject, String body) {
        if (!isConfigured()) {
            log.warn("Email not configured (BREVO_API_KEY or MAIL_USERNAME unset): not sending '{}'", subject);
            return false;
        }
        try {
            if (useBrevo()) {
                if (sender() == null || sender().isBlank()) {
                    log.error("Sending email '{}' failed: set MAIL_FROM to the sender you verified in Brevo", subject);
                    return false;
                }
                http.post().uri(BREVO_URL)
                        .header("api-key", brevoKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(Map.of(
                                "sender", Map.of("name", "FinTrack", "email", sender()),
                                "to", List.of(Map.of("email", to)),
                                "subject", subject,
                                "textContent", body))
                        .retrieve().toBodilessEntity();
            } else {
                SimpleMailMessage m = new SimpleMailMessage();
                m.setFrom(sender());
                m.setTo(to);
                m.setSubject(subject);
                m.setText(body);
                mailSender.send(m);
            }
            return true;
        } catch (Exception e) {
            log.error("Sending email '{}' failed: {}", subject, e.getMessage());
            return false;
        }
    }
}
