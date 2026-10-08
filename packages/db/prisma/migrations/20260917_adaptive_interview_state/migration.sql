-- Adaptive live interview durability: ordered turn metadata and durable replay results.
ALTER TABLE `TranscriptSegment`
  ADD COLUMN `turnId` VARCHAR(191) NULL,
  ADD COLUMN `parentTurnId` VARCHAR(191) NULL,
  ADD COLUMN `sequenceNumber` INTEGER NULL,
  ADD COLUMN `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ADD COLUMN `mode` VARCHAR(191) NOT NULL DEFAULT 'ADAPTIVE';

CREATE INDEX `TranscriptSegment_sessionId_sequenceNumber_idx`
  ON `TranscriptSegment`(`sessionId`, `sequenceNumber`);

CREATE INDEX `TranscriptSegment_sessionId_turnId_idx`
  ON `TranscriptSegment`(`sessionId`, `turnId`);

CREATE TABLE `InterviewTurnResult` (
  `id` VARCHAR(191) NOT NULL,
  `sessionId` VARCHAR(191) NOT NULL,
  `turnId` VARCHAR(191) NOT NULL,
  `ttsKey` VARCHAR(191) NOT NULL,
  `mode` VARCHAR(191) NOT NULL DEFAULT 'FALLBACK',
  `responseJson` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE INDEX `InterviewTurnResult_sessionId_turnId_key`(`sessionId`, `turnId`),
  UNIQUE INDEX `InterviewTurnResult_sessionId_ttsKey_key`(`sessionId`, `ttsKey`),
  INDEX `InterviewTurnResult_sessionId_createdAt_idx`(`sessionId`, `createdAt`),
  CONSTRAINT `InterviewTurnResult_sessionId_fkey`
    FOREIGN KEY (`sessionId`) REFERENCES `InterviewSession`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
