-- CreateEnum
CREATE TYPE "WhatsAppMessageStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'UNDELIVERED', 'READ');

-- CreateEnum
CREATE TYPE "WhatsAppMessageType" AS ENUM ('BOOKING_CONFIRMATION', 'BOOKING_CANCELLATION');

-- DropIndex
DROP INDEX "knowledge_chunks_embedding_hnsw_idx";

-- CreateTable
CREATE TABLE "whatsapp_messages" (
    "id" UUID NOT NULL,
    "message_sid" TEXT,
    "booking_id" TEXT,
    "to_phone" TEXT NOT NULL,
    "from_phone" TEXT NOT NULL,
    "message_type" "WhatsAppMessageType" NOT NULL,
    "body" TEXT NOT NULL,
    "status" "WhatsAppMessageStatus" NOT NULL DEFAULT 'QUEUED',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_messages_message_sid_key" ON "whatsapp_messages"("message_sid");

-- CreateIndex
CREATE INDEX "whatsapp_messages_booking_id_idx" ON "whatsapp_messages"("booking_id");

-- CreateIndex
CREATE INDEX "whatsapp_messages_status_idx" ON "whatsapp_messages"("status");

-- CreateIndex
CREATE INDEX "whatsapp_messages_message_type_idx" ON "whatsapp_messages"("message_type");

-- CreateIndex
CREATE INDEX "whatsapp_messages_created_at_idx" ON "whatsapp_messages"("created_at");

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("booking_id") ON DELETE SET NULL ON UPDATE CASCADE;
