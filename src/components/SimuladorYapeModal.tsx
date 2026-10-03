import React, { useState } from 'react';
import { X, CheckCircle2, AlertTriangle, Smartphone } from 'lucide-react';

interface SimuladorYapeModalProps {
  monto: number;
  ordenId: string;
  onClose: () => void;
  onPagoExitoso: (ordenId: string, nroOperacion: string) => void;
}

export const SimuladorYapeModal: React.FC<SimuladorYapeModalProps> = ({ 
  monto, 
  ordenId, 
  onClose, 
  onPagoExitoso 
}) => {
  const [nroOperacion, setNroOperacion] = useState('');
  const [error, setError] = useState('');
  const [paso, setPaso] = useState<'qr' | 'validacion' | 'exito'>('qr');

  const simularValidacion = () => {
    if (nroOperacion.length === 6 && nroOperacion.startsWith('9')) {
      setError('');
      setPaso('exito');
      setTimeout(() => {
        onPagoExitoso(ordenId, nroOperacion);
        onClose();
      }, 2000);
    } else {
      setError('Código de operación inválido. Intenta con "987654".');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 relative animate-fade-in border border-gray-100">
        
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors">
          <X size={24} />
        </button>

        <div className="flex items-center gap-3 mb-6 border-b pb-4 border-gray-100">
          <div className="bg-purple-100 p-3 rounded-full">
            <Smartphone className="w-8 h-8 text-purple-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Simulador Yape</h2>
            <p className="text-gray-500">Orden #{ordenId.slice(-6)}</p>
          </div>
        </div>

        {paso === 'qr' && (
          <div className="text-center animate-fade-in">
            <p className="text-lg font-medium text-gray-800 mb-2">Escanea para pagar</p>
            <p className="text-3xl font-bold text-purple-600 mb-6">S/ {monto.toFixed(2)}</p>
            
            <img 
              src="https://i.imgur.com/y8QyH9Y.png" 
              alt="QR de Yape de prueba" 
              className="w-64 h-64 mx-auto mb-6 border-4 border-purple-100 p-2 rounded-xl shadow-inner"
            />
            
            <div className="bg-gray-50 p-4 rounded-xl mb-6 flex items-center justify-center gap-3 text-gray-700">
              <span className="text-sm">A nombre de:</span>
              <span className="font-semibold text-gray-900">Panaderia Bimbo S.A.C.</span>
              <span className="bg-purple-600 text-white px-2 py-0.5 rounded text-xs font-bold">B2B</span>
            </div>

            <button 
              onClick={() => setPaso('validacion')}
              className="w-full bg-purple-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-purple-700 transition-colors shadow-md"
            >
              Ya yapeé, validar operación
            </button>
          </div>
        )}

        {paso === 'validacion' && (
          <div className="animate-fade-in">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Validar pago</h3>
            <p className="text-gray-600 mb-6">Ingresa el código de 6 dígitos que aparece en tu voucher de Yape.</p>
            
            <input 
              type="text" 
              maxLength={6}
              value={nroOperacion}
              onChange={(e) => setNroOperacion(e.target.value.replace(/\D/g, ''))}
              placeholder="Ej: 987654"
              className="w-full text-center text-4xl tracking-widest font-mono border-2 border-purple-200 rounded-2xl py-5 px-4 mb-2 focus:ring-4 focus:ring-purple-100 focus:border-purple-400 transition"
            />
            
            {error && (
              <p className="text-red-500 text-sm flex items-center gap-2 mb-4 animate-shake">
                <AlertTriangle size={16} />
                {error}
              </p>
            )}

            <div className="bg-purple-50 border border-purple-100 text-purple-900 p-4 rounded-xl mb-6 text-sm">
              <strong className="block mb-1">¿Cómo encontrar el código?</strong>
              Es el número de 6 dígitos que sale debajo de "¡Yapeaste S/. X.XX!". Para este simulador, usa: <strong>987654</strong>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setPaso('qr')}
                className="flex-1 bg-gray-100 text-gray-700 py-4 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                Atrás
              </button>
              <button 
                onClick={simularValidacion}
                className="flex-1 bg-purple-600 text-white py-4 rounded-xl font-semibold hover:bg-purple-700 transition-colors shadow-md"
              >
                Validar
              </button>
            </div>
          </div>
        )}

        {paso === 'exito' && (
          <div className="text-center py-12 animate-fade-in">
            <CheckCircle2 className="w-24 h-24 text-green-500 mx-auto mb-6 animate-scale-in" />
            <p className="text-3xl font-bold text-gray-900 mb-2">¡Yapeo Validado!</p>
            <p className="text-xl text-gray-600 mb-6">El pago de S/ {monto.toFixed(2)} se ha registrado correctamente.</p>
            <p className="text-sm text-gray-500">Nro. Operación: <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{nroOperacion}</span></p>
            <p className="text-sm text-gray-500 mt-1">Redirigiendo...</p>
          </div>
        )}

      </div>
    </div>
  );
};