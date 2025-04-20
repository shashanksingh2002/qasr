export default {
  dialect: "postgresql",
  schema: "./src/db/schema",
  out: "./src/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  introspect: {
    casing: "camel",
  },
  migrations: {
    prefix: "timestamp",
    table: "drizzle_migrations",
    schema: "public",
  },
  verbose: true,
  strict: true,
};
