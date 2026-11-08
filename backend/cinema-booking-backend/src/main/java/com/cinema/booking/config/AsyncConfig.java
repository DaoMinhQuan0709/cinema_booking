package com.cinema.booking.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * Cau hinh Spring Async xu ly cac tac vu nen (Cong viec 5.3):
 * - Sinh anh QR Code (ZXing)
 * - Gui email xac nhan ve kem ma QR (JavaMailSender)
 */
@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean(name = "ticketTaskExecutor")
    public ThreadPoolTaskExecutor ticketTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(5);
        executor.setMaxPoolSize(20);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("ticket-async-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        return executor;
    }
}
