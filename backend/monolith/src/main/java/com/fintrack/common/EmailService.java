package com.fintrack.common;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * Sends plain-text email through the configured SMTP server (MAIL_HOST,
 * MAIL_USERNAME, MAIL_PASSWORD). Without credentials nothing is sent.
 */
@Service
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;
    private final String username;
    private final String from;

    public EmailService(@Autowired(required = false) JavaMailSender mailSender,
                        @Value("${spring.mail.username:}") String username,
                        @Value("${app.mail.from:}") String from) {
        this.mailSender = mailSender;
        this.username = username;
        this.from = from;
    }

    public boolean isConfigured() {
        return mailSender != null && username != null && !username.isBlank();
    }

    /** True when the message was handed to the SMTP server. */
    public boolean send(String to, String subject, String body) {
        if (!isConfigured()) {
            log.warn("Email not configured (MAIL_USERNAME unset): not sending '{}'", subject);
            return false;
        }
        try {
            SimpleMailMessage m = new SimpleMailMessage();
            m.setFrom(from == null || from.isBlank() ? username : from);
            m.setTo(to);
            m.setSubject(subject);
            m.setText(body);
            mailSender.send(m);
            return true;
        } catch (Exception e) {
            log.error("Sending email '{}' failed: {}", subject, e.getMessage());
            return false;
        }
    }
}
