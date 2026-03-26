-- 为 activity_logs 表添加上报间隔字段
-- 如果上报时传递了 report_interval_seconds，则使用该值判断活动是否过期
-- 否则使用全局的 process_stale_seconds

ALTER TABLE activity_logs 
ADD COLUMN IF NOT EXISTS report_interval_seconds INTEGER DEFAULT NULL;

-- 添加注释说明字段用途
COMMENT ON COLUMN activity_logs.report_interval_seconds IS '上报间隔秒数，超过该时间无新上报则认为活动结束，NULL 时使用全局配置';
