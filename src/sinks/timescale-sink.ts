import type { LogEvent } from "../types";
import type { ILogSink } from "../interfaces";

/** Sink'in ihtiyaç duyduğu en dar SQL sözleşmesi — ISqlDatabase bunu karşılar. */
export interface SqlExecutor {
  execute(sql: string, params?: unknown[]): Promise<void>;
}

/** TimescaleSink yapılandırması — tek obje (DI kuralı 3). */
export interface TimescaleSinkConfig {
  readonly executor: SqlExecutor;
  readonly table?: string;
}

const COLUMN_COUNT = 12;

/**
 * TimescaleSink — `log_events` hypertable'ına çok satırlı tek INSERT
 * (unnest) yazar. Executor hatası yukarı fırlatılır — fail-closed'u tetikler.
 * Bağlantı yaşam döngüsü executor sahibine aittir.
 */
export class TimescaleSink implements ILogSink {
  private readonly table: string;

  constructor(private readonly config: TimescaleSinkConfig) {
    this.table = config.table ?? "log_events";
  }

  name(): string {
    return "timescale";
  }

  async write(events: LogEvent[]): Promise<void> {
    if (events.length === 0) return;
    const arrays: unknown[][] = [
      events.map((event) => event.ts),
      events.map((event) => event.level),
      events.map((event) => event.category),
      events.map((event) => event.eventCode),
      events.map((event) => event.message),
      events.map((event) => JSON.stringify(event.context ?? {})),
      events.map((event) => event.correlationId ?? null),
      events.map((event) => event.service ?? null),
      events.map((event) => event.host ?? null),
      events.map((event) => event.seq),
      events.map((event) => event.prevHash),
      events.map((event) => event.signature),
    ];
    const sql =
      `INSERT INTO ${this.table} ` +
      "(ts, level, category, event_code, message, context, correlation_id, " +
      "service, host, seq, prev_hash, signature) " +
      "SELECT * FROM unnest(" +
      "$1::timestamptz[], $2::text[], $3::text[], $4::text[], $5::text[], " +
      "$6::jsonb[], $7::text[], $8::text[], $9::text[], $10::bigint[], " +
      "$11::text[], $12::text[])";
    await this.config.executor.execute(sql, arrays);
  }

  async close(): Promise<void> {}
}
