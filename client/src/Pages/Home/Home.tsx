import React, { Component } from 'react';
import { Button, ButtonToolbar, Table } from 'react-bootstrap';
import { AddModal } from './AddModal';

interface HomeProps {}

interface HomeState {
  cards: string[];
  addModalShow: boolean;
}

export class Home extends Component<HomeProps, HomeState> {
  constructor(props: HomeProps) {
    super(props);
    this.state = {
      cards: [],
      addModalShow: false,
    };
  }

  login = () =>
    fetch(import.meta.env.VITE_BACKEND_API + 'login', {
      method: 'POST',
      credentials: 'include',
    });

  test = () =>
    fetch(import.meta.env.VITE_BACKEND_API + 'test', {
      credentials: 'include',
    });

  getCards = (): void => {
    fetch(import.meta.env.VITE_BACKEND_API + 'cube', {
      method: 'GET',
    })
      .then((response) => response.json())
      .then(
        (data: string[]) => {
          this.setState({ cards: data });
        },
        (error) => {
          alert(error);
        }
      );
  };

  startDraft = (): void => {
    fetch(import.meta.env.VITE_BACKEND_API + 'startDraft/200', {
      method: 'POST',
    })
      .then((response) => response.json())
      .then(
        (data: string[]) => {
          this.setState({ cards: data });
        },
        (error) => {
          alert(error);
        }
      );
  };

  render() {
    const { cards, addModalShow } = this.state;

    const addModalClose = () => this.setState({ addModalShow: false });

    return (
      <div>
        <ButtonToolbar className="mt-2">
          <Button
            variant="primary"
            onClick={() => this.setState({ addModalShow: true })}
          >
            Add Video
          </Button>

          <Button variant="success" onClick={this.getCards}>
            Get Cards
          </Button>

          <Button variant="secondary" onClick={this.startDraft}>
            Start Draft
          </Button>

          <AddModal show={addModalShow} onHide={addModalClose} />
        </ButtonToolbar>

        <Table className="mt-2" striped bordered hover size="sm">
          <thead>
            <tr>
              <th>Name</th>
              <th>Options</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((card) => (
              <tr key={card}>
                <td>{card}</td>
                <td>
                  <ButtonToolbar>
                    <Button className="me-2" variant="danger">
                      Delete
                    </Button>
                  </ButtonToolbar>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    );
  }
}

