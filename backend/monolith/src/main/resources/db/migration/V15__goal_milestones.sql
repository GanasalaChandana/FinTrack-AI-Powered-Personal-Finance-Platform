-- The highest milestone (25/50/75/100 %) a goal's owner was told about, so each is sent once.
-- Existing goals start at their current milestone: no flood of old milestones.
ALTER TABLE goals ADD COLUMN milestone_notified INT NOT NULL DEFAULT 0;
UPDATE goals SET milestone_notified = CASE
    WHEN target_amount IS NULL OR target_amount <= 0 OR current_amount IS NULL THEN 0
    WHEN current_amount >= target_amount         THEN 100
    WHEN current_amount * 4 >= target_amount * 3 THEN 75
    WHEN current_amount * 2 >= target_amount     THEN 50
    WHEN current_amount * 4 >= target_amount     THEN 25
    ELSE 0 END;
