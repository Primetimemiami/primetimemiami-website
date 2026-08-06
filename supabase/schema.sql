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
