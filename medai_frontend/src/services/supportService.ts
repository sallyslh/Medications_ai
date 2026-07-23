import { api } from "./api";
import { SupportTicket } from "../types";

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export const supportService = {
  /**
   * Fetches the official FAQ documentation.
   */
  async getFAQ(): Promise<FAQItem[]> {
    const response = await api.get<FAQItem[]>("/api/help/faq/");
    return response.data;
  },

  /**
   * Submits a technical or clinical support ticket.
   */
  async createTicket(payload: Partial<SupportTicket>): Promise<SupportTicket> {
    const response = await api.post<SupportTicket>("/api/help/ticket/", payload);
    return response.data;
  },

  /**
   * Retrieves all tickets logged by the authenticated clinician.
   */
  async getTickets(): Promise<SupportTicket[]> {
    const response = await api.get<SupportTicket[]>("/api/help/tickets/");
    return response.data;
  },

  /**
   * Fetches full status of a specific support ticket.
   */
  async getTicketById(id: string): Promise<SupportTicket> {
    const response = await api.get<SupportTicket>(`/api/help/ticket/${id}/`);
    return response.data;
  }
};
