"use client";

import * as React from "react";
import QRCode from "react-qr-code";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { LabelTemplate, LabelField, Product, SalesOrder, Address } from "@/lib/definitions";

interface PrintQueueItem {
    product: Product;
    quantity: number;
}

interface PrintData {
    template: LabelTemplate;
    items: PrintQueueItem[];
    order?: SalesOrder; // Optional order data
}

export default function PrintLabelsPreviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [printData, setPrintData] = React.useState<PrintData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const data = searchParams.get('data');
    if (data) {
      try {
        const decodedData = JSON.parse(atob(decodeURIComponent(data)));
        setPrintData(decodedData);
      } catch (e) {
        setError("Erro ao decodificar os dados de impressão.");
        console.error(e);
      }
    } else {
      setError("Nenhum dado de impressão fornecido.");
    }
  }, [searchParams]);

  const formatCurrency = (value?: number) => {
    if (value === undefined) return "";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };
  
  const formatAddress = (address?: Address) => {
    if (!address) return "Endereço não informado";
    return `${address.address}, ${address.number} ${address.complement ? `(${address.complement})` : ''} - ${address.neighborhood}, ${address.city}/${address.state}`;
  };
  
  const renderField = (field: LabelField, product: Product, volume?: { current: number; total: number }) => {
    let content: React.ReactNode = `[${field.label}]`;

    switch (field.key) {
        case 'name':
            content = product.name;
            break;
        case 'internalCode':
            content = product.internalCode ? `Cód: ${product.internalCode}` : null;
            break;
        case 'barcode':
            content = product.barcode ? (
                <div className="text-center">
                    {/* Placeholder for barcode SVG/Image */}
                    <div style={{ background: '#000', height: '100%', width: '100%' }} />
                    <p style={{ fontSize: '6pt', letterSpacing: '2px', margin: 0 }}>{product.barcode}</p>
                </div>
            ) : null;
            break;
        case 'qrcode':
            // Placeholder for a real QR code. In a real app, you'd use a library to generate this.
            // Using the product's barcode or internal code as the data for the QR code.
            const qrData = product.barcode || product.internalCode || product.id;
            content = (
              <div className="flex flex-col items-center justify-center w-full h-full">
                <div style={{ width: "100%", height: "100%" }}>
                  <QRCode
                    size={256}
                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                    value={qrData}
                    viewBox={`0 0 256 256`}
                  />
                </div>
              </div>
            );
            break;
        case 'salePrice':
            content = formatCurrency(product.salePrice);
            break;
        case 'volumeCount':
            content = (volume && volume.total > 1) ? `${volume.current}/${volume.total}` : null;
            break;
        case 'orderNumber':
            content = printData?.order ? `#${printData.order.orderNumber}` : "[Nº Pedido]";
            break;
        case 'customerName':
            content = printData?.order ? printData.order.customerName : "[Nome Cliente]";
            break;
        case 'deliveryAddress':
            content = printData?.order?.deliveryAddress ? formatAddress(printData.order.deliveryAddress) : "[Endereço]";
            break;
        case 'customText':
            content = field.customTextValue || "";
            break;
    }

    if (!content) return null;

    const fieldStyle: React.CSSProperties = {
        position: 'absolute',
        left: `${field.x}mm`,
        top: `${field.y}mm`,
        fontSize: `${field.fontSize}pt`,
        fontWeight: field.fontWeight as React.CSSProperties['fontWeight'],
        lineHeight: 1.1,
        color: 'black',
    };

    if (field.key === 'qrcode') {
        fieldStyle.width = `${field.size || 20}mm`;
        fieldStyle.height = `${field.size || 20}mm`;
    } else {
        if (field.maxWidth && field.maxWidth > 0) {
            fieldStyle.maxWidth = `${field.maxWidth}mm`;
            fieldStyle.whiteSpace = 'normal';
            fieldStyle.wordBreak = 'break-word';
        } else {
            fieldStyle.whiteSpace = 'nowrap';
        }
    }

    return (
        <div
            key={field.id}
            style={fieldStyle}
        >
            {content}
        </div>
    );
  };


  if (error) {
    return <div className="p-8 text-destructive">{error}</div>;
  }
  
  if (!printData) {
    return <div className="p-8">Carregando...</div>;
  }
  
  const { template, items } = printData;

  const allLabels: React.ReactNode[] = [];
  items.forEach(item => {
    for (let i = 0; i < item.quantity; i++) {
        const totalVolumes = item.product.volumeQuantity || 1;
        for (let j = 1; j <= totalVolumes; j++) {
            allLabels.push(
              <div key={`${item.product.id}-${i}-${j}`} className="print-page">
                <div
                    className="label-card bg-white text-black border border-dashed border-gray-300 overflow-hidden relative p-1"
                    style={{
                        width: `${template.width}mm`,
                        height: `${template.height}mm`,
                    }}
                >
                  {template.fields.map(field => renderField(field, item.product, { current: j, total: totalVolumes }))}
                </div>
              </div>
            );
        }
    }
  });


  return (
    <>
      <style jsx global>{`
        @page {
          size: A4;
          margin: 10mm;
        }
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body * {
            visibility: hidden;
          }
          .print-page {
            page-break-after: always;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .label-card {
            border: 1px dashed #ccc !important;
          }
        }
      `}</style>
      <div className="p-8 bg-gray-100 min-h-screen">
        <div className="flex justify-between items-center mb-8 print:hidden">
           <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
            </Button>
            <h1 className="text-xl font-bold">Pré-visualização da Impressão</h1>
            <Button onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimir
            </Button>
        </div>
        <div id="print-area" className="flex flex-col items-center gap-4">
          {allLabels}
        </div>
      </div>
    </>
  );
}
