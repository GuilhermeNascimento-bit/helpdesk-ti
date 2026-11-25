import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context.jsx';
import { isStaff } from './constants.js';
import { Spinner } from './components/ui.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import TicketList from './pages/TicketList.jsx';
import NewTicket from './pages/NewTicket.jsx';
import TicketDetail from './pages/TicketDetail.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import AdminUsers from './pages/AdminUsers.jsx';
import TechStats from './pages/TechStats.jsx';
import MyTickets from './pages/MyTickets.jsx';

const home = (user) => (user.role === 'admin' ? '/painel' : user.role === 'tecnico' ? '/fila' : '/chamados');

export default function App() {
  const { user, loading } = useAuth();

  if (loading)
    return (
      <div className="boot">
        <Spinner />
      </div>
    );
  if (!user) return <Login />;

  const staff = isStaff(user);
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to={home(user)} replace />} />
        <Route path="chamados" element={staff ? <TicketList key="list" scope="all" /> : <MyTickets />} />
        <Route path="chamados/novo" element={<NewTicket />} />
        <Route path="chamados/:id" element={<TicketDetail />} />
        {staff && <Route path="fila" element={<TicketList key="queue" scope="queue" />} />}
        {staff && <Route path="meus-atendimentos" element={<TicketList key="mine" scope="mine" />} />}
        {staff && <Route path="pendencias" element={<TicketList key="waiting" scope="waiting" />} />}
        {staff && <Route path="meus-chamados" element={<TicketList key="requested" scope="requested" />} />}
        {staff && <Route path="desempenho" element={<TechStats />} />}
        {user.role === 'admin' && <Route path="painel" element={<AdminDashboard />} />}
        {user.role === 'admin' && <Route path="usuarios" element={<AdminUsers />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
