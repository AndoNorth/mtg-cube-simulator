import React, { Component, FormEvent } from 'react';
import { Modal, Button, Row, Col, Form } from 'react-bootstrap';
import type { ModalProps } from 'react-bootstrap';

interface AddModalProps extends ModalProps {
  show: boolean;
  onHide: () => void;
}

export class AddModal extends Component<AddModalProps> {
  constructor(props: AddModalProps) {
    super(props);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;

    const id = (form.elements.namedItem('Id') as HTMLInputElement).value;
    const name = (form.elements.namedItem('Name') as HTMLInputElement).value;
    const likes = (form.elements.namedItem('Likes') as HTMLInputElement).value;
    const views = (form.elements.namedItem('Views') as HTMLInputElement).value;

    fetch(import.meta.env.VITE_BACKEND_API + 'videos/' + id, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        likes: Number(likes),
        views: Number(views),
      }),
    })
      .then((response) => response.json())
      .then(
        (result) => {
          alert(result);
        },
        (error) => {
          alert(error);
        }
      );
  }

  render() {
    return (
      <div className="container">
        <Modal
          {...this.props}
          size="lg"
          aria-labelledby="contained-modal-title-vcenter"
          centered
        >
          <Modal.Header closeButton>
            <Modal.Title id="contained-modal-title-vcenter">
              Add Video
            </Modal.Title>
          </Modal.Header>

          <Modal.Body>
            <Row>
              <Col sm={6}>
                <Form onSubmit={this.handleSubmit}>
                  <Form.Group>
                    <Form.Label>VideoId</Form.Label>
                    <Form.Control
                      type="number"
                      name="Id"
                      required
                      placeholder="5"
                      step="1"
                    />

                    <Form.Label>Name</Form.Label>
                    <Form.Control
                      type="text"
                      name="Name"
                      required
                      placeholder="Video Name"
                      as="textarea"
                      rows={2}
                    />

                    <Form.Label>Likes</Form.Label>
                    <Form.Control
                      type="number"
                      name="Likes"
                      required
                      placeholder="10"
                      step="1"
                    />

                    <Form.Label>Views</Form.Label>
                    <Form.Control
                      type="number"
                      name="Views"
                      required
                      placeholder="10"
                      step="1"
                    />
                  </Form.Group>

                  <br />

                  <Form.Group>
                    <Button variant="primary" type="submit">
                      Add Video
                    </Button>
                  </Form.Group>
                </Form>
              </Col>
            </Row>
          </Modal.Body>

          <Modal.Footer>
            <Button variant="danger" onClick={this.props.onHide}>
              Close
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    );
  }
}

