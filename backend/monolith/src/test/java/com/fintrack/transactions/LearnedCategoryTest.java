package com.fintrack.transactions;

import com.fintrack.auth.entity.User;
import com.fintrack.auth.security.JwtUtil;
import com.fintrack.transactions.service.CategoryRuleService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Changing a merchant's category once applies to its future transactions. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("Learned categories")
class LearnedCategoryTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private ObjectMapper json;

    @org.springframework.test.context.bean.override.mockito.MockitoBean
    private com.fintrack.auth.security.TokenRevocationService tokenRevocationService;

    private String user, bearer;

    @BeforeEach
    void setUp() {
        org.mockito.Mockito.when(tokenRevocationService.isCurrent(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyInt())).thenReturn(true);
        user = UUID.randomUUID().toString();
        bearer = "Bearer " + jwtUtil.generateToken(User.builder().id(UUID.fromString(user)).email(user + "@t.dev").build());
    }

    private long create(String merchant, String category) throws Exception {
        String body = "{\"description\":\"" + merchant + "\",\"merchant\":\"" + merchant + "\",\"amount\":12.5,\"type\":\"EXPENSE\",\"date\":\"2026-10-01\""
                + (category != null ? ",\"category\":\"" + category + "\"" : "") + "}";
        String res = mockMvc.perform(post("/api/transactions").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(res).get("id").asLong();
    }

    private String categoryOf(long id) throws Exception {
        return json.readTree(mockMvc.perform(get("/api/transactions/" + id).header("Authorization", bearer))
                .andReturn().getResponse().getContentAsString()).get("category").asText();
    }

    @Test
    @DisplayName("a recategorized merchant's next transactions get the user's category")
    void learnsFromAnEdit() throws Exception {
        long first = create("Joe's Corner #12", null);
        assertThat(categoryOf(first)).isNotEqualTo("Groceries");

        mockMvc.perform(put("/api/transactions/" + first).header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"description\":\"Joe's Corner #12\",\"merchant\":\"Joe's Corner #12\",\"amount\":12.5,\"type\":\"EXPENSE\",\"date\":\"2026-10-01\",\"category\":\"Groceries\"}"))
                .andExpect(status().isOk());

        // Same merchant, another store number, no category given
        assertThat(categoryOf(create("JOE'S CORNER #47", null))).isEqualTo("Groceries");
        // An explicit category still wins
        assertThat(categoryOf(create("Joe's Corner", "Dining"))).isEqualTo("Dining");
    }

    @Test
    @DisplayName("learned categories are per user")
    void perUser() throws Exception {
        long t = create("Corner Shop", null);
        mockMvc.perform(post("/api/transactions/recategorize").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"merchant\":\"Corner Shop\",\"category\":\"Groceries\"}"))
                .andExpect(status().isOk());
        assertThat(categoryOf(t)).isEqualTo("Groceries");

        setUp(); // someone else
        assertThat(categoryOf(create("Corner Shop", null))).isNotEqualTo("Groceries");
    }

    @Test
    @DisplayName("recategorize updates every transaction from the merchant and reports the count")
    void recategorizeAll() throws Exception {
        create("Gym Co", "Other");
        create("Gym Co #2", "Other");
        create("Other Place", "Other");
        mockMvc.perform(post("/api/transactions/recategorize").header("Authorization", bearer).header("X-Requested-With", "x")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"merchant\":\"Gym Co\",\"category\":\"Fitness\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.updated").value(2));
    }

    @Test
    @DisplayName("merchant keys ignore case, store numbers and spacing")
    void keys() {
        assertThat(CategoryRuleService.key("Starbucks #1234", null)).isEqualTo("starbucks");
        assertThat(CategoryRuleService.key("  STARBUCKS   ", null)).isEqualTo("starbucks");
        assertThat(CategoryRuleService.key(null, "Rent October")).isEqualTo("rent october");
        assertThat(CategoryRuleService.key(" ", null)).isNull();
    }
}
