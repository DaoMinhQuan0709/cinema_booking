package com.cinema.booking.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "application.galaxy")
@Getter
@Setter
public class GalaxySyncProperties {
    private boolean enabled = true;
    private long intervalMs = 300_000;
    private String baseUrl = "https://www.galaxycine.vn";
    private String clientId = "";
    private int connectTimeoutMs = 10_000;
    private int readTimeoutMs = 30_000;
    private Details details = new Details();

    @Getter
    @Setter
    public static class Details {
        private boolean enabled = true;
        private int batchSize = 20;
        private long refreshMs = 21_600_000;
        private long retryMs = 300_000;
    }
}
