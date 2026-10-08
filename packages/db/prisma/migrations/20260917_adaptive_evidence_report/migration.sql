-- Persist the evidence-linked POST report produced from the adaptive state.
ALTER TABLE `InterviewScore`
  ADD COLUMN `adaptiveReportJson` JSON NULL;
