package com.fintrack.transactions;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fintrack.auth.entity.User;
import com.fintrack.auth.security.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("Transaction payment method")
class PaymentMethodIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private ObjectMapper json;
    private String bearer;

    @BeforeEach
    void login() {
        bearer = "Bearer " + jwtUtil.generateToken(User.builder().id(UUID.randomUUID()).email("pm@test.dev").build());
    }

    @Test
    @DisplayName("is saved on create, returned, and can be changed or cleared on update")
    void createAndUpdate() throws Exception {
        String body = mockMvc.perform(post("/api/transactions").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"description\":\"Coffee\",\"amount\":4.5,\"merchant\":\"Cafe\",\"category\":\"Food & Dining\",\"type\":\"EXPENSE\",\"date\":\"2026-10-01\",\"paymentMethod\":\"Visa •••• 1234\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.paymentMethod").value("Visa •••• 1234"))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        long id = json.readTree(body).get("id").asLong();

        mockMvc.perform(put("/api/transactions/" + id).header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"description\":\"Coffee\",\"amount\":4.5,\"merchant\":\"Cafe\",\"category\":\"Food & Dining\",\"type\":\"EXPENSE\",\"date\":\"2026-10-01\",\"paymentMethod\":\"Cash\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paymentMethod").value("Cash"));

        mockMvc.perform(put("/api/transactions/" + id).header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"description\":\"Coffee\",\"amount\":4.5,\"merchant\":\"Cafe\",\"category\":\"Food & Dining\",\"type\":\"EXPENSE\",\"date\":\"2026-10-01\",\"paymentMethod\":\"  \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paymentMethod").value(nullValue()));
    }

    @Test
    @DisplayName("is read from a bank CSV's 'Payment Method' column on upload")
    void csvUpload() throws Exception {
        String csv = "Date,Description,Amount,Type,Category,Payment Method\n"
                + "2026-10-02,Groceries,52.10,EXPENSE,Food & Dining,Mastercard •••• 9001\n"
                + "2026-10-03,Paycheck,2000,INCOME,Salary,Direct Deposit\n";
        MockMultipartFile file = new MockMultipartFile("file", "bank.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8));

        JsonNode res = json.readTree(mockMvc.perform(multipart("/api/transactions/upload").file(file).header("Authorization", bearer))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));

        org.assertj.core.api.Assertions.assertThat(res.get("transactions"))
                .extracting(t -> t.get("paymentMethod").asText())
                .containsExactlyInAnyOrder("Mastercard •••• 9001", "Direct Deposit");
    }
}
