import React, { useState } from 'react';
import { ActionDefinition, BotDefinition } from '../types/appsheet';
import { Bot, Zap, Mail, FileText, Webhook, RefreshCw, Plus, Clock, CheckCircle, ArrowRight } from 'lucide-react';

interface Props {
  actions: ActionDefinition[];
  bots: BotDefinition[];
  onUpdateActions: (actions: ActionDefinition[]) => void;
  onUpdateBots: (bots: BotDefinition[]) => void;
}

export const AutomationMapper: React.FC<Props> = ({
  actions,
  bots,
  onUpdateActions,
  onUpdateBots,
}) => {
  const [activeTab, setActiveTab] = useState<'bots' | 'actions'>('bots');
  const [showAddBotModal, setShowAddBotModal] = useState(false);
  const [newBotName, setNewBotName] = useState('');
  const [newBotTable, setNewBotTable] = useState('');
  const [newBotTrigger, setNewBotTrigger] = useState<BotDefinition['eventTrigger']>('Data Change (Add/Update/Delete)');
  const [newBotTaskType, setNewBotTaskType] = useState<'Send Email' | 'Generate PDF / Document' | 'Run Webhook' | 'Change Status / Data'>('Send Email');
  const [newBotTaskDesc, setNewBotTaskDesc] = useState('');

  const handleAddBot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBotName || !newBotTable) return;

    const newBot: BotDefinition = {
      id: `bot_${Date.now()}`,
      name: newBotName,
      targetTable: newBotTable,
      eventTrigger: newBotTrigger,
      tasks: [
        {
          type: newBotTaskType,
          description: newBotTaskDesc || 'Tarefa configurada da automação'
        }
      ]
    };

    onUpdateBots([...bots, newBot]);
    setNewBotName('');
    setNewBotTable('');
    setNewBotTaskDesc('');
    setShowAddBotModal(false);
  };

  const getTaskIcon = (type: string) => {
    switch (type) {
      case 'Send Email':
        return <Mail className="w-4 h-4 text-blue-500" />;
      case 'Generate PDF / Document':
        return <FileText className="w-4 h-4 text-emerald-500" />;
      case 'Run Webhook':
        return <Webhook className="w-4 h-4 text-purple-500" />;
      default:
        return <RefreshCw className="w-4 h-4 text-amber-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Bot className="w-5 h-5 text-indigo-600" />
              Mapeador de Ações e Bots de Automação
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Identifique e converta eventos do AppSheet (Adds, Updates, Agendamentos) e tarefas (Email, PDF, Webhook) para a arquitetura web.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-slate-100 p-1 rounded-lg flex text-xs font-semibold">
              <button
                onClick={() => setActiveTab('bots')}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  activeTab === 'bots' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Bots & Automações ({bots.length})
              </button>
              <button
                onClick={() => setActiveTab('actions')}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  activeTab === 'actions' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Ações de Botão ({actions.length})
              </button>
            </div>

            <button
              onClick={() => setShowAddBotModal(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Cadastrar Bot
            </button>
          </div>
        </div>
      </div>

      {/* Content based on Tab */}
      {activeTab === 'bots' ? (
        <div className="space-y-4">
          {bots.map((bot) => (
            <div
              key={bot.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:border-indigo-200 transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{bot.name}</h4>
                    <span className="text-[11px] text-slate-500">
                      Tabela Alvo: <span className="font-semibold text-slate-700">{bot.targetTable}</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {bot.eventTrigger}
                  </span>
                </div>
              </div>

              {bot.condition && (
                <div className="mt-3 text-xs font-mono bg-slate-50 text-slate-700 p-2.5 rounded-lg border border-slate-200">
                  <span className="font-sans font-semibold text-slate-500 mr-2">Condição AppSheet:</span>
                  {bot.condition}
                </div>
              )}

              {/* Tasks list */}
              <div className="mt-3 space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Tarefas Executadas no Bot
                </span>
                {bot.tasks.map((task, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200/60"
                  >
                    <div className="mt-0.5">{getTaskIcon(task.type)}</div>
                    <div className="flex-1">
                      <div className="text-xs font-bold text-slate-800">{task.type}</div>
                      <div className="text-xs text-slate-600 mt-0.5">{task.description}</div>
                    </div>
                    <div className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                      Backend Service
                    </div>
                  </div>
                ))}
              </div>

              {/* Equivalence Strategy Box */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  Estratégia: Endpoint Express / Cloud Functions disparado em transação segura
                </span>
              </div>
            </div>
          ))}

          {bots.length === 0 && (
            <div className="text-center py-10 bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
              Nenhum bot cadastrado. Clique em &quot;Cadastrar Bot&quot; acima para registrar automações do seu AppSheet.
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {actions.map((act) => (
            <div
              key={act.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:border-blue-200 transition-all"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <h4 className="text-sm font-bold text-slate-900">{act.name}</h4>
                </div>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                  Tabela: {act.targetTable}
                </span>
              </div>

              <div className="mt-2 text-xs text-slate-600">
                <strong>Comportamento:</strong> {act.details}
              </div>

              {act.condition && (
                <div className="mt-2 text-xs font-mono bg-slate-50 text-slate-700 p-2 rounded border border-slate-200">
                  <span className="font-sans font-semibold text-slate-500 mr-1">Only if:</span> {act.condition}
                </div>
              )}

              <div className="mt-3 text-[11px] text-slate-500 flex items-center gap-2">
                <span className="font-semibold text-blue-600">Mapeamento Web:</span>
                <span>Botão de ação na tabela ou barra superior chamando mutation hook no React</span>
              </div>
            </div>
          ))}

          {actions.length === 0 && (
            <div className="text-center py-10 bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
              Nenhuma ação cadastrada ainda.
            </div>
          )}
        </div>
      )}

      {/* Modal Cadastrar Bot */}
      {showAddBotModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200">
            <h4 className="text-base font-bold text-slate-900 mb-1">Cadastrar Bot / Automação do AppSheet</h4>
            <p className="text-xs text-slate-500 mb-4">
              Descreva a regra de disparo e o que o bot deve fazer (enviar e-mail, gerar PDF, etc.).
            </p>

            <form onSubmit={handleAddBot} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome do Bot</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Notificar Técnico por E-mail"
                  value={newBotName}
                  onChange={(e) => setNewBotName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tabela Alvo</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: OrdensServico"
                    value={newBotTable}
                    onChange={(e) => setNewBotTable(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Gatilho (Trigger)</label>
                  <select
                    value={newBotTrigger}
                    onChange={(e) => setNewBotTrigger(e.target.value as any)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Data Change (Add/Update/Delete)">Alteração de Dados (Add/Edit/Del)</option>
                    <option value="Schedule (Cron)">Agendamento (Horário / Cron)</option>
                    <option value="Webhook">Webhook Externo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de Tarefa</label>
                <select
                  value={newBotTaskType}
                  onChange={(e) => setNewBotTaskType(e.target.value as any)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Send Email">Enviar E-mail (Send Email)</option>
                  <option value="Generate PDF / Document">Gerar PDF / Documento</option>
                  <option value="Change Status / Data">Atualizar Linha em Outra Tabela</option>
                  <option value="Run Webhook">Disparar Webhook</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Detalhes da Execução</label>
                <textarea
                  rows={2}
                  placeholder="Ex: Envia e-mail para o cliente com resumo dos itens e link do atendimento"
                  value={newBotTaskDesc}
                  onChange={(e) => setNewBotTaskDesc(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddBotModal(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm"
                >
                  Salvar Bot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
