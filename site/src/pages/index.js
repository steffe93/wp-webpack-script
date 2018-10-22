import React from 'react';
import { Link, graphql } from 'gatsby';

import './index.scss';

import Layout from '../components/layout';
import Hero from '../components/hero';
import Feature from '../components/feature';

import { ReactComponent as Development } from '../components/svgs/development.svg';
import { ReactComponent as Cloud } from '../components/svgs/cloud.svg';
import { ReactComponent as Dependendable } from '../components/svgs/dependable.svg';

const IndexPage = ({ data: { mission } }) => (
	<Layout>
		<Hero
			title={
				<>
					front-end <em>tooling</em> for WordPress themes &amp;
					plugins
				</>
			}
			cta={<Link to="/docs/">Get Started</Link>}
			subtitle={
				<>
					wpackio is a fine-tuned <em>webpack/browser-sync</em>{' '}
					configuration made specifically for{' '}
					<em>WordPress Theme and Plugin Development</em>. It gives a
					fine Developer Experience (DX) and a single dependency for
					all your bundling requirement.
				</>
			}
			terminalTitle="🔥wpackio-scripts start (node)"
		>
			<p>
				<span className="command">cd</span> ~/my-awesome-plugin-or-theme
			</p>
			<p className="comment">
				# initiate the tooling to your existing project
			</p>
			<p>
				<span className="command">npx</span> @wpackio/cli
			</p>
			<p className="comment"># bootstrap project</p>
			<p>
				<span className="command">npm</span> run bootstrap
			</p>
			<p className="comment"># start development server</p>
			<p>
				<span className="command">npm</span> start
			</p>
			<p className="comment"># create production build</p>
			<p>
				<span className="command">npm</span> run build
			</p>
		</Hero>
		<section className="wpackio-home-features section">
			<div className="container">
				<div className="columns">
					<div className="column is-one-third">
						<Feature
							icon={
								<Dependendable height="128px" width="128px" />
							}
							title="Single Dependency"
						>
							<p>
								Forget worrying about webpack, browser-sync,
								loaders, babel etc. <code>wpackio-scripts</code>{' '}
								comes with everything packed and ready to use.
							</p>
						</Feature>
					</div>
					<div className="column is-one-third">
						<Feature
							icon={<Cloud height="128px" width="128px" />}
							title="Lightning Fast"
						>
							<p>
								Built with webpack and browser-sync, wpackio
								development server is lightning fast. In
								development mode, compilation takes only a few (
								<em>milli</em>
								)seconds.
							</p>
						</Feature>
					</div>
					<div className="column is-one-third">
						<Feature
							icon={<Development height="128px" width="128px" />}
							title="Best DX"
						>
							<p>
								We give you best possible developer experience
								with hot reloading, automatic file watching,
								terminal preview and much more.
							</p>
						</Feature>
					</div>
				</div>
			</div>
		</section>
		<section className="section">
			<div className="container">
				{console.log(mission)}
				{mission.edges.map(({ node }) => {
					const { html, id, frontmatter } = node;
					return (
						<div key={id}>
							<h3 className="title">{frontmatter.title}</h3>
							<div
								className="content"
								dangerouslySetInnerHTML={{ __html: html }}
							/>
						</div>
					);
				})}
			</div>
		</section>
	</Layout>
);

export default IndexPage;

export const query = graphql`
	query {
		mission: allMarkdownRemark(
			filter: { fileAbsolutePath: { regex: "/mission/" } }
			sort: { order: DESC, fields: frontmatter___order }
		) {
			edges {
				node {
					html
					id
					frontmatter {
						title
						order
					}
				}
			}
		}
	}
`;