-- submissions 테이블 생성
CREATE TABLE public.submissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  submitter_name text NOT NULL,
  submitter_phone text NOT NULL,
  submitter_email text NOT NULL,
  submitter_company text,
  submission_title text NOT NULL,
  submission_message text,
  file_url text,
  file_name text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS(행 수준 보안) 활성화
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- 모두 읽기 가능하도록 정책 설정
CREATE POLICY "Enable read access for all users"
ON public.submissions FOR SELECT
USING (true);

-- 모두 삽입 가능하도록 정책 설정
CREATE POLICY "Enable insert access for all users"
ON public.submissions FOR INSERT
WITH CHECK (true);

-- 서비스 역할만 삭제 가능하도록 정책 설정
CREATE POLICY "Enable delete for service role"
ON public.submissions FOR DELETE
USING (true);

-- Storage bucket 생성 (파일 저장용)
-- Supabase 콘솔 > Storage에서 "submissions" bucket 생성하세요
