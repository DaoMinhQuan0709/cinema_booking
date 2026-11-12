package com.cinema.booking;

import com.cinema.booking.config.CustomUserDetailsService;
import com.cinema.booking.config.JwtAuthenticationFilter;
import com.cinema.booking.config.JwtTokenProvider;
import com.cinema.booking.config.SecurityConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.userdetails.User;
import org.springframework.test.context.junit.jupiter.web.SpringJUnitWebConfig;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import java.util.Map;

import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real security filter chain with mocked JWT/user lookup; no DB, Redis or external API. */
@SpringJUnitWebConfig(SecurityAuthorizationTests.TestConfig.class)
class SecurityAuthorizationTests {
    @Autowired private WebApplicationContext context;
    @Autowired private JwtTokenProvider tokens;
    @Autowired private CustomUserDetailsService users;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        reset(tokens, users);
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    @Test
    void anonymousRequestsReturnJson401ForProfileAndAdmin() throws Exception {
        for (String path : new String[]{"/api/v1/users/me", "/api/v1/admin/reports"}) {
            mvc.perform(get(path)).andExpect(status().isUnauthorized())
                    .andExpect(content().contentTypeCompatibleWith("application/json"))
                    .andExpect(jsonPath("$.code").value(401));
        }
        verifyNoInteractions(users);
    }

    @Test
    void invalidOrExpiredBearerReturns401RatherThanRoleDenial() throws Exception {
        when(tokens.validateToken("expired-token")).thenReturn(false);
        mvc.perform(get("/api/v1/users/me").header("Authorization", "Bearer expired-token"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value(401));
        verifyNoInteractions(users);
    }

    @Test
    void customerCanReadProfileButCannotEnterAdmin() throws Exception {
        bearer("customer-token", "CUSTOMER");
        mvc.perform(get("/api/v1/users/me").header("Authorization", "Bearer customer-token"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/admin/reports").header("Authorization", "Bearer customer-token"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value(403));
    }

    @Test
    void adminCanReadProtectedContent() throws Exception {
        bearer("admin-token", "ADMIN");
        mvc.perform(get("/api/v1/admin/reports").header("Authorization", "Bearer admin-token"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data").value("protected"));
    }

    @Test
    void publicCatalogStillAllowsAnonymousRequests() throws Exception {
        mvc.perform(get("/api/v1/movies")).andExpect(status().isOk());
        verifyNoInteractions(users);
    }

    private void bearer(String token, String role) {
        when(tokens.validateToken(token)).thenReturn(true);
        when(tokens.getEmailFromToken(token)).thenReturn("test@example.invalid");
        when(users.loadUserByUsername("test@example.invalid"))
                .thenReturn(User.withUsername("test@example.invalid").password("unused").roles(role).build());
    }

    @Configuration
    @EnableWebMvc
    @Import(SecurityConfig.class)
    static class TestConfig {
        @Bean JwtTokenProvider tokens() { return mock(JwtTokenProvider.class); }
        @Bean CustomUserDetailsService users() { return mock(CustomUserDetailsService.class); }
        @Bean JwtAuthenticationFilter jwtFilter(JwtTokenProvider tokens, CustomUserDetailsService users) {
            return new JwtAuthenticationFilter(tokens, users);
        }
        @Bean ProbeController controller() { return new ProbeController(); }
    }

    @RestController
    static class ProbeController {
        @GetMapping({"/api/v1/users/me", "/api/v1/admin/reports", "/api/v1/movies"})
        Map<String, Object> read() { return Map.of("code", 200, "data", "protected"); }
    }
}
