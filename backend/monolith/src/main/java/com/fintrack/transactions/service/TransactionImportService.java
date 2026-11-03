package com.fintrack.transactions.service;

import com.fintrack.transactions.dto.CreateTransactionRequest;
import com.fintrack.transactions.entity.ImportJob;
import com.fintrack.transactions.repository.ImportJobRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Starts background CSV imports and reports their progress.
 *
 * Before: the browser sent one request per row (2,000 rows = 2,000 requests, and
 * closing the tab left a half-finished import). Now it sends every row in one
 * request, gets a job id back straight away, and polls the job.
 */
@Service
@RequiredArgsConstructor
public class TransactionImportService {

    public static final int MAX_ROWS = 10_000;

    private final ImportJobRepository jobRepository;
    private final ImportJobRunner runner;

    /** Thrown when too many imports are already queued. */
    public static class BusyException extends RuntimeException {
        public BusyException() { super("Too many imports are running; please try again in a minute."); }
    }

    public ImportJob start(String userId, List<CreateTransactionRequest> rows) {
        ImportJob job = new ImportJob();
        job.setId(UUID.randomUUID());
        job.setUserId(userId);
        job.setStatus(ImportJob.Status.PENDING);
        job.setTotal(rows.size());
        job.setCreatedAt(LocalDateTime.now());
        job.setUpdatedAt(job.getCreatedAt());
        jobRepository.save(job);

        try {
            runner.run(job.getId(), userId, List.copyOf(rows));
        } catch (TaskRejectedException e) {
            job.setStatus(ImportJob.Status.FAILED);
            job.setError("Too many imports are running; please try again in a minute.");
            job.setUpdatedAt(LocalDateTime.now());
            jobRepository.save(job);
            throw new BusyException();
        }
        return job;
    }

    /** The job, only if it belongs to this user. */
    public Optional<ImportJob> find(UUID jobId, String userId) {
        return jobRepository.findByIdAndUserId(jobId, userId);
    }
}
