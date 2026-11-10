package com.fintrack.userdata;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("Saved user data (debts, net worth, ...)")
class UserDataTest {

    @Autowired private MockMvc mvc;
    @Autowired private UserDataRepository repo;
    private static final AtomicInteger ip = new AtomicInteger(1);

    record Person(String id, String bearer) {}

    private ResultActions call(MockHttpServletRequestBuilder req, Person p, String body) throws Exception {
        req.header("X-Forwarded-For", "192.0.2." + ip.getAndIncrement()).header("Authorization", p.bearer());
        if (body != null) req.contentType(MediaType.APPLICATION_JSON).content(body);
        return mvc.perform(req);
    }

    private Person signup() throws Exception {
        var r = mvc.perform(post("/api/auth/register").header("X-Forwarded-For", "192.0.2." + ip.getAndIncrement())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"ud-" + UUID.randomUUID() + "@test.dev\",\"password\":\"Secret123!\"}"))
                .andExpect(status().isOk()).andReturn();
        String id = com.jayway.jsonpath.JsonPath.read(r.getResponse().getContentAsString(), "$.user.id");
        return new Person(id, "Bearer " + r.getResponse().getCookie("ft_at").getValue());
    }

    @Test
    @DisplayName("saves, returns, replaces and deletes; each user sees only their own")
    void roundTrip() throws Exception {
        Person a = signup(), b = signup();
        call(put("/api/user-data/fintrack-debts"), a, "[{\"name\":\"Card\",\"balance\":1200}]").andExpect(status().isNoContent());
        call(put("/api/user-data/fintrack-nw-target"), a, "50000").andExpect(status().isNoContent());
        call(get("/api/user-data"), a, null).andExpect(jsonPath("$['fintrack-debts'][0].balance").value(1200))
                .andExpect(jsonPath("$['fintrack-nw-target']").value(50000));
        call(get("/api/user-data"), b, null).andExpect(content().json("{}"));

        call(put("/api/user-data/fintrack-debts"), a, "[]").andExpect(status().isNoContent());
        call(get("/api/user-data"), a, null).andExpect(jsonPath("$['fintrack-debts']").isEmpty());
        call(delete("/api/user-data/fintrack-nw-target"), a, null).andExpect(status().isNoContent());
        call(get("/api/user-data"), a, null).andExpect(jsonPath("$['fintrack-nw-target']").doesNotExist());
    }

    @Test
    @DisplayName("rejects unknown keys and oversized values; removed with the account")
    void limits() throws Exception {
        Person a = signup();
        call(put("/api/user-data/other-app-key"), a, "1").andExpect(status().isBadRequest());
        call(put("/api/user-data/fintrack-big"), a, "\"" + "x".repeat(UserDataController.MAX_VALUE_CHARS) + "\"")
                .andExpect(status().isBadRequest());
        call(put("/api/user-data/fintrack:settings-categories"), a, "[\"Pets\"]").andExpect(status().isNoContent());
        assertThat(repo.findByUserId(a.id())).hasSize(1);

        call(delete("/api/users/me"), a, null).andExpect(status().isOk());
        assertThat(repo.findByUserId(a.id())).isEmpty();
    }
}
