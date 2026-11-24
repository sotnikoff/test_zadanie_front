import type {
  Generation,
  GenerationQuote,
  GeneratePoemRequest,
} from "../../../../shared/types/models";
export interface GenerationGateway {
  getQuote(): Promise<GenerationQuote>;
  generate(request: GeneratePoemRequest): Promise<Generation>;
  findById(id: string): Promise<Generation>;
  findAll(): Promise<Generation[]>;
}
