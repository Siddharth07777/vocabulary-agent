alter table public.words enable row level security;
alter table public.word_content enable row level security;
alter table public.mcqs enable row level security;
alter table public.generation_jobs enable row level security;


-- =========================================================
-- WORDS
-- =========================================================

create policy "anon insert words"
on public.words
for insert
to anon
with check (
    length(trim(word)) between 1 and 80
);


create policy "anon read words"
on public.words
for select
to anon
using (true);


-- IMPORTANT:
-- No anon UPDATE policy.
--
-- An unauthenticated anon key cannot prove ownership
-- of a pending row.
--
-- Vercel service key performs state transitions.


create policy "service role all words"
on public.words
for all
to service_role
using (true)
with check (true);


-- =========================================================
-- WORD CONTENT
-- =========================================================

create policy "anon read content"
on public.word_content
for select
to anon
using (true);


create policy "service role all content"
on public.word_content
for all
to service_role
using (true)
with check (true);


-- =========================================================
-- MCQS
-- =========================================================

create policy "anon read mcqs"
on public.mcqs
for select
to anon
using (true);


create policy "service role all mcqs"
on public.mcqs
for all
to service_role
using (true)
with check (true);


-- =========================================================
-- GENERATION JOBS
-- =========================================================

create policy "service role all jobs"
on public.generation_jobs
for all
to service_role
using (true)
with check (true);


-- Explicit grants.
grant select, insert
on public.words
to anon;

grant select
on public.word_content
to anon;

grant select
on public.mcqs
to anon;

grant all
on public.words
to service_role;

grant all
on public.word_content
to service_role;

grant all
on public.mcqs
to service_role;

grant all
on public.generation_jobs
to service_role;
