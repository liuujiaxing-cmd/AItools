import postgres from "postgres";

export function createDb() {
  const url = String(process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/toolset");
  return postgres(url, { max: 10 });
}

export async function migrate(sql: ReturnType<typeof postgres>) {
  await sql`
    create table if not exists tools (
      id bigserial primary key,
      name text not null,
      version text not null,
      description text not null,
      entrypoint text not null,
      dependencies jsonb not null default '[]'::jsonb,
      config_schema jsonb not null default '{}'::jsonb,
      enabled boolean not null default true,
      created_at timestamptz not null default now(),
      unique(name, version)
    );
  `;

  await sql`
    create table if not exists api_keys (
      id bigserial primary key,
      api_key_id text not null unique,
      api_key text not null unique,
      api_secret text not null,
      name text not null,
      scopes jsonb not null default '[]'::jsonb,
      enabled boolean not null default true,
      created_at timestamptz not null default now()
    );
  `;
}

