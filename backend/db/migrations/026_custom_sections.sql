-- Custom stock section metadata (label + roll/count type)
CREATE TABLE IF NOT EXISTS custom_sections (
    section_id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    section_type TEXT NOT NULL CHECK(section_type IN ('count', 'roll')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

