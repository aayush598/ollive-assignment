-- Create a NOTIFY trigger on inference_logs for event-based ingestion pipeline
CREATE OR REPLACE FUNCTION notify_inference_log_insert()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'inference_log_inserted',
    json_build_object(
      'id', NEW.id,
      'provider', NEW.provider,
      'model', NEW.model,
      'status', NEW.status,
      'latency_ms', NEW.latency_ms,
      'total_tokens', NEW.total_tokens,
      'created_at', NEW.created_at
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS inference_log_insert_trigger ON inference_logs;
CREATE TRIGGER inference_log_insert_trigger
  AFTER INSERT ON inference_logs
  FOR EACH ROW
  EXECUTE FUNCTION notify_inference_log_insert();
