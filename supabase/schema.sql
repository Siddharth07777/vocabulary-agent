create extension if not exists pgcrypto;

create table if not exists public.words (
    id uuid primary key default gen_random_uuid(),

    word text not null unique,

    source_path text,
    source_text text not null default '',

    content_hash text not null,

    status text not null default 'pending'
        check (status in (
            'pending',
            'generating',
            'validating',
            'published',
            'failed',
            'review'
        )),

    attempts integer not null default 0,
    last_error text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_words_status
on public.words(status);

create index if not exists idx_words_hash
on public.words(content_hash);

create table if not exists public.word_content (
    id uuid primary key default gen_random_uuid(),

    word_id uuid not null
        references public.words(id)
        on delete cascade,

    word text not null,

    part_of_speech text not null,

    simple_meaning text not null,

    synonyms jsonb not null default '[]'::jsonb,

    antonyms jsonb not null default '[]'::jsonb,

    examples jsonb not null default '[]'::jsonb,

    validation jsonb not null default '{}'::jsonb,

    content_hash text not null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    unique(word_id)
);

create index if not exists idx_word_content_word
on public.word_content(word);


create table if not exists public.mcqs (
    id uuid primary key default gen_random_uuid(),

    word_id uuid not null
        references public.words(id)
        on delete cascade,

    question text not null,

    options jsonb not null,

    correct_answer text not null,

    explanation text not null,

    source_type text not null
        check (source_type in (
            'REAL_PYQ',
            'PYQ_STYLE'
        )),

    exam_name text,

    exam_year integer,

    created_at timestamptz not null default now(),

    check (
        source_type = 'PYQ_STYLE'
        or (
            source_type = 'REAL_PYQ'
            and exam_name is not null
            and exam_year is not null
        )
    )
);

create index if not exists idx_mcqs_word_id
on public.mcqs(word_id);


create table if not exists public.generation_jobs (
    id uuid primary key default gen_random_uuid(),

    word text not null,

    word_id uuid
        references public.words(id)
        on delete cascade,

    content_hash text not null unique,

    status text not null default 'pending'
        check (status in (
            'pending',
            'generating',
            'validating',
            'published',
            'failed',
            'review'
        )),

    attempts integer not null default 0,

    max_attempts integer not null default 3,

    last_error text,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now()
);

create index if not exists idx_jobs_status_updated
on public.generation_jobs(status, updated_at);


create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists words_touch_updated_at
on public.words;

create trigger words_touch_updated_at
before update on public.words
for each row
execute function public.touch_updated_at();


drop trigger if exists word_content_touch_updated_at
on public.word_content;

create trigger word_content_touch_updated_at
before update on public.word_content
for each row
execute function public.touch_updated_at();


drop trigger if exists generation_jobs_touch_updated_at
on public.generation_jobs;

create trigger generation_jobs_touch_updated_at
before update on public.generation_jobs
for each row
execute function public.touch_updated_at();
