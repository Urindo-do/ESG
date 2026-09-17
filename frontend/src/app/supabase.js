// Supabase 연결 — 공개 키만 쓴다 (sb_secret_…·service_role 금지)
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

if (import.meta.env.DEV) {
  // 개발 중 콘솔에서 직접 확인용 (배포 빌드에는 포함되지 않음)
  window.__supabase = supabase;
}
