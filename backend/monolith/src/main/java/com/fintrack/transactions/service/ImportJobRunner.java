package com.fintrack.transactions.service;

import com.fintrack.config.AsyncConfig;
import com.fintrack.transactions.dto.CreateTransactionRequest;
import com.fintrack.transactions.entity.ImportJob;
import com.fintrack.transactions.repository.ImportJobRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Saves an import's rows in the background. Each row is its own transaction, so a
 * bad row is counted as failed instead of rolling back the rest; progress is
 * written every {@link #PROGRESS_EVERY} rows for the browser to poll.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ImportJobRunner {

    static final int PROGRESS_EVERY = 25;

    private final TransactionService transactionService;
    private final ImportJobRepository jobRepository;

    @Async(AsyncConfig.IMPORT_EXECUTOR)
    public void run(UUID jobId, String userId, List<CreateTransactionRequest> rows) {
        ImportJob job = jobRepository.findById(jobId).orElse(null);
        if (job == null) return;
        try {
            save(job, ImportJob.Status.RUNNING);
            for (CreateTransactionRequest row : rows) {
                try {
                    transactionService.createTransaction(row, userId);
                    job.setImported(job.getImported() + 1);
                } catch (Exception e) {
                    job.setFailed(job.getFailed() + 1);
                    log.debug("Import {}: row failed: {}", jobId, e.getMessage());
                }
                job.setProcessed(job.getProcessed() + 1);
                if (job.getProcessed() % PROGRESS_EVERY == 0) save(job, ImportJob.Status.RUNNING);
            }
            save(job, ImportJob.Status.DONE);
            log.info("Import {} done: {} imported, {} failed", jobId, job.getImported(), job.getFailed());
        } catch (Exception e) {
            log.error("Import {} failed: {}", jobId, e.getMessage(), e);
            job.setError("The import stopped unexpectedly; rows saved so far were kept.");
            save(job, ImportJob.Status.FAILED);
        }
    }

    private void save(ImportJob job, ImportJob.Status status) {
        job.setStatus(status);
        job.setUpdatedAt(LocalDateTime.now());
        jobRepository.save(job);
    }
}
