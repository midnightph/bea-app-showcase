// ============================================================
// Agenda.tsx — Selected excerpts from BEA (Beauty Easy App)
// Full codebase is private for business reasons.
// ============================================================

// --- Firestore: Fetch appointments for a selected day ---
const fetchAgendamentos = useCallback(async () => {
  if (user && selectedDate) {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    const end = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

    const q = query(
      collection(database, 'user', uid, 'Agendamentos'),
      where('data', '>=', Timestamp.fromDate(start)),
      where('data', '<=', Timestamp.fromDate(end))
    );
    const querySnapshot = await getDocs(q);
    const data = querySnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a: any, b: any) => a.data.seconds - b.data.seconds);
    setAgendamentos(data);
  }
}, [user, selectedDate]);

// --- Firestore: Toggle blocked day (block/unblock) ---
const toggleBloqueioDia = async (dateStr: string) => {
  const diaRef = doc(database, 'user', uid, 'diasBloqueados', dateStr);
  const estaBloqueado = !!diasBloqueados[dateStr];

  if (estaBloqueado) {
    await deleteDoc(diaRef);
    const { [dateStr]: _, ...rest } = diasBloqueados;
    setDiasBloqueados(rest);
  } else {
    await setDoc(diaRef, { dateStr });
    setDiasBloqueados(prev => ({
      ...prev,
      [dateStr]: { disabled: true, textColor: 'gray', dotColor: '#cccccc' },
    }));
  }
};

// --- Confirm pending appointment + Google Calendar integration ---
const confirmarAgendamentoPendente = async () => {
  if (!selectedPendente || !user) return;

  const isSignedin = await GoogleSignin.getCurrentUser();
  let accessToken = null;
  if (isSignedin) {
    const tokens = await GoogleSignin.getTokens();
    accessToken = tokens.accessToken;
  }

  const startDate = selectedPendente.data.toDate();
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

  // Move from AgendamentosConfirmar → Agendamentos
  const agendamentoConfirmado = {
    nomeCliente: clienteSearchTerm || selectedPendente.nomeCliente,
    procedimento: selectedPendente.procedimento,
    data: selectedPendente.data,
    telefone: selectedPendente.telefone,
    clienteId,
  };
  await addDoc(collection(database, 'user', uid, 'Agendamentos'), agendamentoConfirmado);
  await deleteDoc(doc(database, 'user', uid, 'AgendamentosConfirmar', selectedPendente.id));

  // Optionally sync to Google Calendar
  if (isSignedin) {
    await GoogleSignin.addScopes({ scopes: ['https://www.googleapis.com/auth/calendar.events'] });
    await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: agendamentoConfirmado.nomeCliente,
        description: agendamentoConfirmado.procedimento,
        start: { dateTime: startDate.toISOString(), timeZone: 'America/Sao_Paulo' },
        end: { dateTime: endDate.toISOString(), timeZone: 'America/Sao_Paulo' },
      }),
    });
  }
};

// --- Save configurable business hours per weekday with breaks ---
const salvarHorarios = async () => {
  for (const dia of ORDEM_DIAS) {
    const dados = horariosConfig[dia];
    if (dados.ativo) {
      if (!horarioValido(dados.inicio) || !horarioValido(dados.fim)) {
        Toast.show({ type: 'error', text1: `Horário inválido em ${dia}` });
        return;
      }
      for (const pausa of dados.pausas) {
        if (!horarioValido(pausa.inicio) || !horarioValido(pausa.fim)) {
          Toast.show({ type: 'error', text1: `Pausa inválida em ${dia}` });
          return;
        }
      }
    }
  }
  await setDoc(doc(database, 'user', uid, 'configuracoes', 'horarios'), horariosConfig);
};

// --- Debounced client search for linking to pending appointment ---
const debouncedSearch = useRef(
  debounce(async (text: string) => {
    if (text.length < 2) return;
    const q = query(
      collection(database, 'user', currentUser.uid, 'Clientes'),
      where('name', '>=', text.toLowerCase()),
      where('name', '<=', text.toLowerCase() + '\uf8ff'),
      limit(10)
    );
    const snap = await getDocs(q);
    setClientes(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
  }, 500)
).current;
