CREATE TABLE "WebsiteContent" (
    "id" VARCHAR(64) NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "draft" JSONB,
    "published" JSONB,
    "publishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WebsiteContent_pkey" PRIMARY KEY ("id")
);
