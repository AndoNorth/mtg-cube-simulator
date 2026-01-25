import { NavLink } from 'react-router-dom';
import { Navbar, Nav } from 'react-bootstrap';

export const Navigation = () => (
  <Navbar bg="dark">
    <Nav>
      <NavLink to="/">Home</NavLink>
      <NavLink to="/draft">Draft</NavLink>
    </Nav>
  </Navbar>
);

