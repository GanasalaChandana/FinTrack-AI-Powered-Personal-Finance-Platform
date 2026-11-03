package com.fintrack.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/**
 * Background work (CSV imports). Deliberately small: the free instance has a
 * fraction of one CPU, so imports run one or two at a time and the rest queue;
 * a full queue is rejected (the caller gets 503) instead of piling up memory.
 */
@Configuration
@EnableAsync
public class AsyncConfig {

    public static final String IMPORT_EXECUTOR = "importExecutor";

    @Bean(name = IMPORT_EXECUTOR)
    public Executor importExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(2);
        executor.setQueueCapacity(20);
        executor.setThreadNamePrefix("import-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        executor.initialize();
        return executor;
    }
}
