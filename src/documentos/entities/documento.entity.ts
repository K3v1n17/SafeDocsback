export class Documento {
  id: string;
  owner_id: string;
  title: string;
  description?: string;
  doc_type?: string;
  tags: string[];
  mime_type: string;
  file_size: number;
  file_path: string;
  checksum_sha256: string;
  created_at: Date;
  updated_at: Date;
}
