ALTER TABLE `InterviewSession`
  ADD COLUMN `recordingStatus` VARCHAR(191) NOT NULL DEFAULT 'NONE',
  ADD COLUMN `recordingSharedAt` DATETIME(3) NULL;
