package com.fintrack.households;

import com.fintrack.auth.entity.User;
import com.fintrack.auth.repository.UserRepository;
import com.fintrack.budgets.repository.BudgetRepository;
import com.fintrack.common.BadRequestException;
import com.fintrack.common.EmailService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Households: a few people who share budgets. The owner invites by email; the
 * invite link only works for the account with that email. Leaving or being removed
 * makes your shared budgets personal again; deleting the household does that for all.
 */
@Service
@Slf4j
public class HouseholdService {

    public static final int MAX_MEMBERS = 6;
    private static final int INVITE_DAYS = 7;

    private final HouseholdRepository households;
    private final HouseholdMemberRepository members;
    private final HouseholdInviteRepository invites;
    private final BudgetRepository budgets;
    private final UserRepository users;
    private final EmailService email;
    private final String appUrl;
    private final SecureRandom random = new SecureRandom();

    public HouseholdService(HouseholdRepository households, HouseholdMemberRepository members,
                            HouseholdInviteRepository invites, BudgetRepository budgets, UserRepository users,
                            EmailService email, @Value("${app.base-url:https://fintrack-liart.vercel.app}") String appUrl) {
        this.households = households;
        this.members = members;
        this.invites = invites;
        this.budgets = budgets;
        this.users = users;
        this.email = email;
        this.appUrl = appUrl.replaceAll("/+$", "");
    }

    public record MemberView(String userId, String name, String email, String role) {}
    public record InviteView(UUID id, String email, LocalDateTime expiresAt) {}
    public record HouseholdView(UUID id, String name, boolean youAreOwner, List<MemberView> members, List<InviteView> invites) {}

    /** The household id the user belongs to, if any. */
    public Optional<UUID> householdOf(String userId) {
        return members.findById(userId).map(HouseholdMember::getHouseholdId);
    }

    /** User ids of everyone in the household. */
    public List<String> memberIds(UUID householdId) {
        return members.findByHouseholdId(householdId).stream().map(HouseholdMember::getUserId).toList();
    }

    public Optional<HouseholdView> view(String userId) {
        return members.findById(userId).map(m -> {
            Household h = households.findById(m.getHouseholdId()).orElseThrow();
            List<MemberView> ms = members.findByHouseholdId(h.getId()).stream().map(x -> {
                Optional<User> u = user(x.getUserId());
                return new MemberView(x.getUserId(), u.map(HouseholdService::displayName).orElse("Member"),
                        u.map(User::getEmail).orElse(null), x.getRole().name());
            }).toList();
            boolean owner = m.getRole() == HouseholdMember.Role.OWNER;
            List<InviteView> is = owner
                    ? invites.findByHouseholdIdAndAcceptedFalse(h.getId()).stream()
                        .filter(i -> i.getExpiresAt().isAfter(LocalDateTime.now()))
                        .map(i -> new InviteView(i.getId(), i.getEmail(), i.getExpiresAt())).toList()
                    : List.of();
            return new HouseholdView(h.getId(), h.getName(), owner, ms, is);
        });
    }

    @Transactional
    public HouseholdView create(String userId, String name) {
        if (members.existsById(userId)) throw new BadRequestException("You're already in a household");
        Household h = new Household();
        h.setName(cleanName(name));
        h.setOwnerId(userId);
        h.setCreatedAt(LocalDateTime.now());
        households.save(h);
        members.save(member(userId, h.getId(), HouseholdMember.Role.OWNER));
        return view(userId).orElseThrow();
    }

    @Transactional
    public HouseholdView rename(String userId, String name) {
        Household h = ownedHousehold(userId);
        h.setName(cleanName(name));
        households.save(h);
        return view(userId).orElseThrow();
    }

    @Transactional
    public void invite(String userId, String rawEmail) {
        Household h = ownedHousehold(userId);
        String to = rawEmail == null ? "" : rawEmail.trim().toLowerCase(Locale.ROOT);
        if (!to.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) throw new BadRequestException("Enter a valid email address");
        long pending = invites.findByHouseholdIdAndAcceptedFalse(h.getId()).stream()
                .filter(i -> i.getExpiresAt().isAfter(LocalDateTime.now())).count();
        if (members.findByHouseholdId(h.getId()).size() + pending >= MAX_MEMBERS) {
            throw new BadRequestException("A household can have up to " + MAX_MEMBERS + " people");
        }
        user(userId).filter(u -> to.equalsIgnoreCase(u.getEmail())).ifPresent(u -> {
            throw new BadRequestException("You're already in this household");
        });

        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        HouseholdInvite inv = new HouseholdInvite();
        inv.setHouseholdId(h.getId());
        inv.setEmail(to);
        inv.setTokenHash(sha256(token));
        inv.setInvitedBy(userId);
        inv.setCreatedAt(LocalDateTime.now());
        inv.setExpiresAt(LocalDateTime.now().plusDays(INVITE_DAYS));
        invites.save(inv);

        String from = user(userId).map(HouseholdService::displayName).orElse("Someone");
        boolean sent = email.send(to, from + " invited you to share budgets on FinTrack", """
                Hi,

                %s invited you to join the household "%s" on FinTrack, to share budgets.
                Your own transactions stay private: members only see the totals of shared budgets.

                Accept the invitation (sign in or create an account with this email address first):
                %s/household/join?token=%s

                The link works for %d days. If you weren't expecting this, ignore it.

                FinTrack
                """.formatted(from, h.getName(), appUrl, token, INVITE_DAYS));
        if (!sent) {
            // Throwing rolls the invite back, so the owner can simply try again
            throw new com.fintrack.common.BadRequestException("Couldn't send the invitation email. Please try again later.");
        }
    }

    @Transactional
    public void cancelInvite(String userId, UUID inviteId) {
        Household h = ownedHousehold(userId);
        invites.delete(invites.findByIdAndHouseholdId(inviteId, h.getId())
                .orElseThrow(() -> new BadRequestException("Invitation not found")));
    }

    /** Join with an invite link. The signed-in account's email must match the invite. */
    @Transactional
    public HouseholdView join(String userId, String token) {
        HouseholdInvite inv = invites.findByTokenHash(sha256(token == null ? "" : token))
                .filter(i -> !i.isAccepted() && i.getExpiresAt().isAfter(LocalDateTime.now()))
                .orElseThrow(() -> new BadRequestException("This invitation is invalid or has expired. Ask for a new one."));
        String myEmail = user(userId).map(User::getEmail).orElse("");
        if (!inv.getEmail().equalsIgnoreCase(myEmail)) {
            throw new BadRequestException("This invitation was sent to " + mask(inv.getEmail())
                    + ". Sign in with that email address to accept it.");
        }
        if (members.existsById(userId)) throw new BadRequestException("You're already in a household. Leave it first.");
        if (!households.existsById(inv.getHouseholdId())) throw new BadRequestException("That household no longer exists");
        members.save(member(userId, inv.getHouseholdId(), HouseholdMember.Role.MEMBER));
        inv.setAccepted(true);
        invites.save(inv);
        return view(userId).orElseThrow();
    }

    /** A member leaves; their shared budgets become personal. The owner deletes the household instead. */
    @Transactional
    public void leave(String userId) {
        HouseholdMember m = members.findById(userId).orElseThrow(() -> new BadRequestException("You're not in a household"));
        if (m.getRole() == HouseholdMember.Role.OWNER) {
            throw new BadRequestException("You own this household: delete it instead (that ends sharing for everyone)");
        }
        budgets.unshareAllForUser(userId);
        members.delete(m);
    }

    @Transactional
    public void removeMember(String ownerId, String memberId) {
        Household h = ownedHousehold(ownerId);
        if (ownerId.equals(memberId)) throw new BadRequestException("You can't remove yourself: delete the household instead");
        HouseholdMember m = members.findById(memberId).filter(x -> x.getHouseholdId().equals(h.getId()))
                .orElseThrow(() -> new BadRequestException("Not a member of your household"));
        budgets.unshareAllForUser(memberId);
        members.delete(m);
    }

    /** Ends the household: every shared budget becomes its creator's personal budget again. */
    @Transactional
    public void delete(String ownerId) {
        Household h = ownedHousehold(ownerId);
        budgets.unshareAllForHousehold(h.getId());
        members.findByHouseholdId(h.getId()).forEach(members::delete);
        invites.findByHouseholdIdAndAcceptedFalse(h.getId()).forEach(invites::delete);
        households.delete(h);
    }

    /** For account deletion. */
    @Transactional
    public void removeUser(String userId) {
        members.findById(userId).ifPresent(m -> {
            if (m.getRole() == HouseholdMember.Role.OWNER) delete(userId);
            else leave(userId);
        });
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private Household ownedHousehold(String userId) {
        HouseholdMember m = members.findById(userId).orElseThrow(() -> new BadRequestException("You're not in a household"));
        if (m.getRole() != HouseholdMember.Role.OWNER) throw new BadRequestException("Only the household's owner can do that");
        return households.findById(m.getHouseholdId()).orElseThrow();
    }

    private static HouseholdMember member(String userId, UUID householdId, HouseholdMember.Role role) {
        HouseholdMember m = new HouseholdMember();
        m.setUserId(userId);
        m.setHouseholdId(householdId);
        m.setRole(role);
        m.setJoinedAt(LocalDateTime.now());
        return m;
    }

    private Optional<User> user(String userId) {
        try { return users.findById(UUID.fromString(userId)); } catch (IllegalArgumentException e) { return Optional.empty(); }
    }

    private static String displayName(User u) {
        String first = u.getFirstName() == null ? "" : u.getFirstName().trim();
        if (!first.isEmpty()) return first + (u.getLastName() == null || u.getLastName().isBlank() ? "" : " " + u.getLastName().trim());
        if (u.getName() != null && !u.getName().isBlank()) return u.getName().trim();
        return u.getEmail() == null ? "Member" : u.getEmail().split("@")[0];
    }

    private static String cleanName(String name) {
        String n = name == null ? "" : name.trim();
        if (n.isEmpty()) throw new BadRequestException("Give the household a name");
        return n.length() > 100 ? n.substring(0, 100) : n;
    }

    /** "j***@example.com": enough to recognise the address without disclosing it. */
    private static String mask(String email) {
        int at = email.indexOf('@');
        return at <= 1 ? email : email.charAt(0) + "***" + email.substring(at);
    }

    static String sha256(String s) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) { throw new IllegalStateException(e); }
    }
}
