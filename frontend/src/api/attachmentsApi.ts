import client from './client';

export const attachmentsApi = {
  list: (voucherId: string) => client.get(`/tenant/accounting/vouchers/${voucherId}/attachments`).then((r: any) => r?.data?.data ?? r?.data ?? r),
  upload: (voucherId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return client.post(`/tenant/accounting/vouchers/${voucherId}/attachments`, form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then((r: any) => r?.data?.data ?? r?.data ?? r);
  },
  remove: (voucherId: string, attachmentId: string) => client.delete(`/tenant/accounting/vouchers/${voucherId}/attachments/${attachmentId}`)
};

export default attachmentsApi;
