-- 添加 display_timezone 字段到 site_config 表
-- 默认值为 Asia/Shanghai (GMT+8)

-- PostgreSQL 版本
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'site_config' AND column_name = 'display_timezone'
    ) THEN
        ALTER TABLE site_config 
        ADD COLUMN display_timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Shanghai';
    END IF;
END $$;
