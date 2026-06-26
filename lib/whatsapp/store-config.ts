import { getPublicSiteUrl } from '@/lib/public-site-url';

const STORE_SITE_URL = getPublicSiteUrl();

export const STORE_INFO = {
  address: [
    'A Pastoril Moda Country fica na:',
    '',
    'Rua 24 de Janeiro, 231',
    'Bairro Seis de Agosto',
    'CEP 69905-596',
    'Rio Branco - AC. 🤎',
  ].join('\n'),
  hours: [
    'Nosso horário de funcionamento é:',
    '',
    'Segunda a sexta: 07:00 às 17:00',
    'Sábado: 07:00 às 13:00',
    'Domingo: fechado. 🤎',
  ].join('\n'),
  instagram: 'Nosso Instagram é @pastorilcountry. 🤎',
  siteNotice: `Você pode conhecer nossa vitrine em:\n\n${STORE_SITE_URL}`,
  siteUrl: STORE_SITE_URL,
};

export const STORE_GENERAL_HELP_MESSAGE =
  'Olá! Como posso ajudar? Posso mostrar novidades por categoria, informar nosso horário, endereço ou encaminhar para uma atendente. 🤎';

export const STORE_GALLERY_CONTEXT_REMINDER =
  'Quando quiser, você também pode digitar o número de uma das fotos enviadas ou pedir outra categoria.';

export const STORE_DELIVERY_PURCHASE_MESSAGE =
  'Posso te ajudar com produtos e categorias por aqui. Para fechar compra, formas de entrega ou detalhes finais do pedido, encaminho você para nossa equipe humana. 🤎';
