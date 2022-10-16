import { NextPage } from "next";
import { Layout } from "../components/Layout";

const ErrorPage: NextPage = () => (
  <Layout>
    <div className="_404">500</div>
  </Layout>
);

export default ErrorPage;
