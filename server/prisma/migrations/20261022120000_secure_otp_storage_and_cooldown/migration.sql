-- AlterTable
-- The plaintext OTP column is replaced by a keyed hash of the code so that a
-- leaked database row cannot be used to complete a verification.
ALTER TABLE "User" ADD COLUMN     "verificationCodeHash" TEXT,
ADD COLUMN     "verificationSentAt" TIMESTAMP(3),
ADD COLUMN     "verificationAttempts" INTEGER NOT NULL DEFAULT 0;

-- Any code stored in plaintext is dropped on purpose: users who still have a
-- pending code get a fresh one automatically on their next login attempt.
ALTER TABLE "User" DROP COLUMN "verificationCode";
