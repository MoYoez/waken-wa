-- 为 activity_logs 表添加 updated_at 字段
-- 用于追踪活动的最后上报时间

ALTER TABLE activity_logs 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 设置触发器，每次更新记录时自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 先删除可能存在的旧触发器
DROP TRIGGER IF EXISTS update_activity_logs_updated_at ON activity_logs;

-- 创建触发器
CREATE TRIGGER update_activity_logs_updated_at
    BEFORE UPDATE ON activity_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON COLUMN activity_logs.updated_at IS '最后更新时间，用于判断活动是否因超时而结束';
