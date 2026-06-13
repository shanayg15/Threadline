-- Custom SQL migration file, put your code below! --
-- Enable pgvector. Must run before any table with a vector() column or HNSW index.
CREATE EXTENSION IF NOT EXISTS vector;