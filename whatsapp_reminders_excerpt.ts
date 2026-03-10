// ============================================================
// lembretes.tsx — Selected excerpts from BEA (Beauty Easy App)
// Full codebase is private for business reasons.
// ============================================================

// --- Fetch tomorrow's appointments, today's birthdays, and inactive clients ---
const fetchDados = async () => {
  const hoje = new Date();
  const amanha = new Date();
  amanha.setDate(hoje.getDate() + 1);

  // Tomorrow's appointments
  const agendamentoSnapshot = await getDocs(collection(database, 'user', uid, 'Agendamentos'));
  const lembretesAmanha: Lembrete[] = [];
  agendamentoSnapshot.forEach(doc => {
    const dataAgendamento = doc.data().data?.toDate?.();
    if (
      dataAgendamento?.getDate() === amanha.getDate() &&
      dataAgendamento?.getMonth() === amanha.getMonth() &&
      dataAgendamento?.getFullYear() === amanha.getFullYear()
    ) {
      lembretesAmanha.push({ id: doc.id, ...doc.data() } as Lembrete);
    }
  });

  // Today's birthdays + inactive clients (15+ days without appointment)
  const clienteSnapshot = await getDocs(collection(database, 'user', uid, 'Clientes'));
  const aniversariantesHoje: Aniversariante[] = [];
  const clientesInativosTemp: ClienteInativo[] = [];

  for (const docCliente of clienteSnapshot.docs) {
    const cliente = docCliente.data();
    const clienteId = docCliente.id;

    // Birthday check
    const nascimento = cliente.dataNasc?.toDate?.();
    if (nascimento?.getDate() === hoje.getDate() && nascimento?.getMonth() === hoje.getMonth()) {
      aniversariantesHoje.push({ id: clienteId, ...cliente } as Aniversariante);
    }

    // Inactivity check: last appointment > 15 days ago
    const historicoQuery = query(
      collection(database, 'user', uid, 'Clientes', clienteId, 'Historico'),
      orderBy('data', 'desc'),
      limit(1)
    );
    const historicoSnapshot = await getDocs(historicoQuery);
    if (historicoSnapshot.empty) continue;

    const ultimoAtendimento = historicoSnapshot.docs[0].data().data?.toDate?.();
    if (!ultimoAtendimento) continue;

    const diffDias = (hoje.getTime() - ultimoAtendimento.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDias > 15) {
      // Avoid sending the same reminder twice
      const lembreteDoc = await getDoc(doc(database, 'user', uid, 'UltimosLembretes', clienteId));
      if (!lembreteDoc.exists()) {
        clientesInativosTemp.push({ id: clienteId, ...cliente } as ClienteInativo);
        await setDoc(doc(database, 'user', uid, 'UltimosLembretes', clienteId), { enviadoEm: hoje });
      }
    }
  }

  setLembretes(lembretesAmanha);
  setAniversariantes(aniversariantesHoje);
  setClientesInativos(clientesInativosTemp);
};

// --- WhatsApp deep link: appointment confirmation message ---
// Opens WhatsApp with a pre-filled confirmation message for tomorrow's appointment
Linking.openURL(
  `https://wa.me/55${telefone.replace(/\D/g, '')}?text=Ol%C3%A1%20${nomeCliente}%2C%20poder%C3%A1%20confirmar%20o%20seu%20hor%C3%A1rio%20no%20dia%20${data.toLocaleDateString()}%20%C3%A0s%20${data.toLocaleTimeString().slice(0, 5)}%3F%20😊`
);

// --- WhatsApp deep link: birthday message ---
Linking.openURL(
  `https://wa.me/55${telefone.replace(/\D/g, '')}?text=Parab%C3%A9ns%20${nome}%20pelo%20seu%20anivers%C3%A1rio!%20🎉🎂`
);

// --- WhatsApp deep link: inactive client reactivation message ---
Linking.openURL(
  `https://wa.me/55${telefone.replace(/\D/g, '')}?text=Oi%20${nome}%2C%20sentimos%20sua%20falta%20aqui!%20%F0%9F%98%81%20Que%20tal%20agendar%20um%20novo%20hor%C3%A1rio%3F`
);
