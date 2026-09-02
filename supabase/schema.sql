-- Prime Time Miami — inventory schema. Run once in the Supabase SQL editor at launch.

create table if not exists pieces (
    id          text primary key,
    brand       text not null,
    model       text not null,
    ref         text default '',
    year        text default '',
    case_material text default '',
    dial_color  text default '',
    condition   text default '',
    description text default '',
    image       text default '',
    featured    boolean default false,
    sold        boolean default false,
    created_at  timestamptz default now(),
    updated_at  timestamptz default now()
);

alter table pieces enable row level security;

-- public read, writes only via service role (the admin API)
create policy "public read pieces" on pieces for select using (true);

-- storage bucket for piece photos (public read)
insert into storage.buckets (id, name, public) values ('pieces', 'pieces', true)
on conflict (id) do nothing;

create policy "public read piece photos" on storage.objects
for select using (bucket_id = 'pieces');

-- Inquiry submissions from the site forms (buy / sell / trade / watch detail).
-- Written only by the service role inside api/submit-form.js. No public access.
create table if not exists pt_submissions (
    id              uuid primary key default gen_random_uuid(),
    submission_type text not null,
    email           text not null,
    full_name       text,
    watch_details   text,
    watch_name      text,
    watch_ref       text,
    status          text not null default 'new',
    created_at      timestamptz not null default now()
);

alter table pt_submissions enable row level security;
-- intentionally no policies: anon/authenticated get nothing, service role bypasses RLS

-- ─────────────────────────────────────────────────────────────
-- JOURNAL (added 2026-09-02). Public reads published only; all writes go
-- through the service role inside api/journal-admin.js.
-- ─────────────────────────────────────────────────────────────
create table if not exists journal_articles (
    id                   uuid primary key default gen_random_uuid(),
    slug                 text unique not null,
    title                text not null,
    subtitle             text,
    excerpt              text,
    hero_image_url       text,
    hero_alt             text,
    content_html         text not null default '',
    content_json         jsonb,
    category             text,
    author_name          text default 'Prime Time Miami',
    status               text not null default 'draft' check (status in ('draft', 'published', 'archived')),
    published_at         timestamptz,
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now(),
    seo_title            text,
    seo_description      text,
    reading_time_minutes int,
    view_count           int not null default 0
);

create index if not exists idx_journal_articles_slug on journal_articles(slug);
create index if not exists idx_journal_articles_status_published on journal_articles(status, published_at desc);

create or replace function update_journal_articles_updated_at()
returns trigger
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_journal_articles_updated_at on journal_articles;
create trigger trg_journal_articles_updated_at
    before update on journal_articles
    for each row execute function update_journal_articles_updated_at();

alter table journal_articles enable row level security;

drop policy if exists "public read published articles" on journal_articles;
create policy "public read published articles" on journal_articles
    for select to anon, authenticated using (status = 'published');

-- storage bucket for hero + inline images (public read)
insert into storage.buckets (id, name, public) values ('journal-images', 'journal-images', true)
on conflict (id) do nothing;

drop policy if exists "public read journal images" on storage.objects;
create policy "public read journal images" on storage.objects
    for select using (bucket_id = 'journal-images');
