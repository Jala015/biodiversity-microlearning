declare module "*.yaml" {
  const content: any; // ou você pode definir um tipo mais específico, se souber a estrutura
  export default content;
}
