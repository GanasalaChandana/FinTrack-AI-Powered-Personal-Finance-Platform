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

    @Test
    @DisplayName("the model learns from the user's history: suggests a category for an unseen merchant")
    void modelFromHistory() throws Exception {
        // 18 labelled transactions in three of the user's own categories
        for (int i = 0; i < 6; i++) {
            create("Green Leaf Market " + i, "Groceries");
            create("Night Owl Cinema " + i, "Fun Money");
            create("Metro Water Works " + i, "Home Bills");
        }
        // A merchant it has never seen, sharing words with one category
        String res = mockMvc.perform(post("/api/transactions/classify").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"merchant\":\"Night Owl Cinema Downtown\",\"amount\":12.5,\"type\":\"EXPENSE\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        var node = json.readTree(res);
        assertThat(node.get("category").asText()).isEqualTo("Fun Money"); // a label only this user uses
        assertThat(node.get("source").asText()).isEqualTo("model");
        assertThat(node.get("confidence").asDouble()).isGreaterThanOrEqualTo(0.6);

        // And new transactions without a category use it
        assertThat(categoryOf(create("Night Owl Cinema Uptown", null))).isEqualTo("Fun Money");

        // Accuracy is reported against a majority-class baseline
        mockMvc.perform(get("/api/transactions/category-model").header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trained").value(true))
                .andExpect(jsonPath("$.examples").value(19))
                .andExpect(jsonPath("$.accuracy").value(org.hamcrest.Matchers.greaterThan(0.9)))
                .andExpect(jsonPath("$.baselineAccuracy").value(org.hamcrest.Matchers.lessThan(0.5)));
    }

    @Test
    @DisplayName("with too little history the model stays out and keyword rules answer")
    void tooLittleHistory() throws Exception {
        create("Night Owl Cinema", "Fun Money");
        mockMvc.perform(post("/api/transactions/classify").header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"merchant\":\"Night Owl Cinema 2\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.source").value("keywords"));
        mockMvc.perform(get("/api/transactions/category-model").header("Authorization", bearer))
                .andExpect(jsonPath("$.trained").value(false));
    }
}
