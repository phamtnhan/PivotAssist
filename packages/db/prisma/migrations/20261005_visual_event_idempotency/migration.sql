ALTER TABLE `VisualEventLog`
  ADD UNIQUE INDEX `VisualEventLog_sessionId_seq_key` (`sessionId`, `seq`);
